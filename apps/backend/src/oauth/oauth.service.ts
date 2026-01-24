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
  authed_user: { id: string };
  error?: string;
}

@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);
  private readonly pendingStates = new Map<
    string,
    { installationId: number; createdAt: number }
  >();

  constructor(
    private readonly configService: ConfigService,
    private readonly db: DatabaseService,
    private readonly slackService: SlackService,
  ) {}

  getInstallUrl(installationId: number): string {
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
      `OAuth install redirect for installation ${installationId}, state=${stateKey}`,
    );
    return url;
  }

  getInstallationIdForState(stateKey: string): number | null {
    const pending = this.pendingStates.get(stateKey);
    if (!pending) return null;
    this.pendingStates.delete(stateKey);
    return pending.installationId;
  }

  async handleCallback(
    code: string,
    installationId: number | null,
  ): Promise<{
    teamId: string;
    teamName: string;
    installationId: number | null;
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

    return {
      teamId: data.team.id,
      teamName: data.team.name,
      installationId,
    };
  }
}
