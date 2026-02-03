import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DatabaseService } from "../database";
import { SlackService } from "../slack/slack.service";

interface SlackOAuthResponse {
  ok: boolean;
  access_token: string;
  token_type: string;
  scope: string;
  bot_user_id: string;
  app_id: string;
  team: { id: string; name: string };
  authed_user: { id: string; access_token?: string; scope?: string };
  error?: string;
}

interface SlackUserOAuthResponse {
  ok: boolean;
  access_token: string;
  token_type: string;
  scope: string;
  app_id: string;
  team: { id: string; name: string };
  authed_user: { id: string; access_token: string; scope: string };
  error?: string;
}

interface UserOAuthState {
  userId: number;
  workspaceId: number;
  createdAt: number;
}

@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);
  private readonly pendingStates = new Map<
    string,
    { installationId: number; userId?: number; createdAt: number }
  >();
  private readonly pendingUserStates = new Map<string, UserOAuthState>();

  constructor(
    private readonly configService: ConfigService,
    private readonly db: DatabaseService,
    private readonly slackService: SlackService,
  ) {}

  getInstallUrl(installationId: number, userId?: number): string {
    const clientId = this.configService.get<string>("slack.clientId");
    if (!clientId) {
      throw new Error("SLACK_CLIENT_ID not configured");
    }

    const redirectUrl = this.configService.get<string>(
      "slack.oauthRedirectUrl",
    );
    const scopes = [
      "channels:manage",
      "channels:read",
      "chat:write",
      "users:read",
      "users:read.email",
    ].join(",");

    const stateKey = crypto.randomUUID();
    this.pendingStates.set(stateKey, {
      installationId,
      userId,
      createdAt: Date.now(),
    });

    // Clean up states older than 10 minutes
    for (const [key, val] of this.pendingStates) {
      if (Date.now() - val.createdAt > 10 * 60 * 1000) {
        this.pendingStates.delete(key);
      }
    }

    const params = new URLSearchParams({
      client_id: clientId,
      scope: scopes,
      state: stateKey,
    });

    if (redirectUrl) {
      params.set("redirect_uri", redirectUrl);
    }

    const url = `https://slack.com/oauth/v2/authorize?${params.toString()}`;
    this.logger.log(
      `OAuth install redirect for installation ${installationId}${userId ? `, user ${userId}` : ""}, state=${stateKey}`,
    );
    return url;
  }

  getStateData(
    stateKey: string,
  ): { installationId: number; userId?: number } | null {
    const pending = this.pendingStates.get(stateKey);
    if (!pending) return null;
    this.pendingStates.delete(stateKey);
    return { installationId: pending.installationId, userId: pending.userId };
  }

  async handleCallback(
    code: string,
    installationId: number | null,
    installerUserId?: number,
  ): Promise<{
    teamId: string;
    teamName: string;
    installationId: number | null;
    workspaceId: number;
  }> {
    const clientId = this.configService.get<string>("slack.clientId");
    const clientSecret = this.configService.get<string>("slack.clientSecret");
    const redirectUrl = this.configService.get<string>(
      "slack.oauthRedirectUrl",
    );

    if (!clientId || !clientSecret) {
      throw new Error("Slack OAuth credentials not configured");
    }

    // Exchange code for token
    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    });

    if (redirectUrl) {
      params.set("redirect_uri", redirectUrl);
    }

    const response = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const data = (await response.json()) as SlackOAuthResponse;

    if (!data.ok) {
      throw new Error(`Slack OAuth error: ${data.error}`);
    }

    // Store workspace
    const workspace = await this.db.slackWorkspace.upsert({
      where: { teamId: data.team.id },
      update: {
        teamName: data.team.name,
        botToken: data.access_token,
        botUserId: data.bot_user_id,
        installedBy: data.authed_user.id,
      },
      create: {
        teamId: data.team.id,
        teamName: data.team.name,
        botToken: data.access_token,
        botUserId: data.bot_user_id,
        installedBy: data.authed_user.id,
      },
    });

    // Clear cached client so next call picks up new token
    this.slackService.clearCachedClient(data.team.id);

    // Create or update OrgMapping only if we have an installationId
    if (installationId) {
      await this.db.orgMapping.upsert({
        where: { githubInstallationId: installationId },
        update: { slackWorkspaceId: workspace.id },
        create: {
          githubInstallationId: installationId,
          slackWorkspaceId: workspace.id,
        },
      });
      this.logger.log(
        `OAuth complete: workspace ${data.team.name} (${data.team.id}) linked to installation ${installationId}`,
      );
    } else {
      this.logger.log(
        `OAuth complete: workspace ${data.team.name} (${data.team.id}) registered (no GitHub installation linked yet)`,
      );
    }

    // Create workspace membership for the installer as admin
    if (installerUserId) {
      await this.db.workspaceMembership.upsert({
        where: {
          userId_slackWorkspaceId: {
            userId: installerUserId,
            slackWorkspaceId: workspace.id,
          },
        },
        update: {
          role: "admin", // Upgrade to admin if already a member
        },
        create: {
          userId: installerUserId,
          slackWorkspaceId: workspace.id,
          role: "admin",
        },
      });
      this.logger.log(
        `Added user ${installerUserId} as admin to workspace ${workspace.id}`,
      );
    }

    return {
      teamId: data.team.id,
      teamName: data.team.name,
      installationId,
      workspaceId: workspace.id,
    };
  }

  // ========== User OAuth (for Slack impersonation) ==========

  getUserConnectUrl(userId: number, workspaceId: number): string {
    const clientId = this.configService.get<string>("slack.clientId");
    if (!clientId) {
      throw new Error("SLACK_CLIENT_ID not configured");
    }

    const redirectUrl = this.configService.get<string>(
      "slack.userOauthRedirectUrl",
    );

    // User token scopes for posting as the user
    const userScopes = "chat:write";

    const stateKey = crypto.randomUUID();
    this.pendingUserStates.set(stateKey, {
      userId,
      workspaceId,
      createdAt: Date.now(),
    });

    // Clean up states older than 10 minutes
    for (const [key, val] of this.pendingUserStates) {
      if (Date.now() - val.createdAt > 10 * 60 * 1000) {
        this.pendingUserStates.delete(key);
      }
    }

    const params = new URLSearchParams({
      client_id: clientId,
      user_scope: userScopes,
      state: stateKey,
    });

    if (redirectUrl) {
      params.set("redirect_uri", redirectUrl);
    }

    const url = `https://slack.com/oauth/v2/authorize?${params.toString()}`;
    this.logger.log(
      `User OAuth connect redirect for user ${userId}, workspace ${workspaceId}, state=${stateKey}`,
    );
    return url;
  }

  getUserStateData(stateKey: string): UserOAuthState | null {
    const pending = this.pendingUserStates.get(stateKey);
    if (!pending) return null;
    this.pendingUserStates.delete(stateKey);
    return pending;
  }

  async handleUserCallback(
    code: string,
    userId: number,
    workspaceId: number,
  ): Promise<{ slackUserId: string; teamName: string }> {
    const clientId = this.configService.get<string>("slack.clientId");
    const clientSecret = this.configService.get<string>("slack.clientSecret");
    const redirectUrl = this.configService.get<string>(
      "slack.userOauthRedirectUrl",
    );

    if (!clientId || !clientSecret) {
      throw new Error("Slack OAuth credentials not configured");
    }

    // Exchange code for token
    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    });

    if (redirectUrl) {
      params.set("redirect_uri", redirectUrl);
    }

    const response = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const data = (await response.json()) as SlackUserOAuthResponse;

    if (!data.ok) {
      throw new Error(`Slack OAuth error: ${data.error}`);
    }

    // Verify the workspace matches
    const workspace = await this.db.slackWorkspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new Error("Workspace not found");
    }

    if (workspace.teamId !== data.team.id) {
      throw new Error(
        `Slack workspace mismatch: expected ${workspace.teamId}, got ${data.team.id}. Please connect to the correct Slack workspace.`,
      );
    }

    // Store the user's Slack token in their workspace membership
    await this.db.workspaceMembership.update({
      where: {
        userId_slackWorkspaceId: {
          userId,
          slackWorkspaceId: workspaceId,
        },
      },
      data: {
        slackUserId: data.authed_user.id,
        slackAccessToken: data.authed_user.access_token,
      },
    });

    this.logger.log(
      `User ${userId} connected Slack account ${data.authed_user.id} in workspace ${workspaceId}`,
    );

    return {
      slackUserId: data.authed_user.id,
      teamName: data.team.name,
    };
  }

  async disconnectSlackUser(
    userId: number,
    workspaceId: number,
  ): Promise<void> {
    await this.db.workspaceMembership.update({
      where: {
        userId_slackWorkspaceId: {
          userId,
          slackWorkspaceId: workspaceId,
        },
      },
      data: {
        slackUserId: null,
        slackAccessToken: null,
      },
    });

    this.logger.log(
      `User ${userId} disconnected Slack account from workspace ${workspaceId}`,
    );
  }
}
