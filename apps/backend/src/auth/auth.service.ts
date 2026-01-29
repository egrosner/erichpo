import type {
  JwtPayload as AppJwtPayload,
  CurrentUser,
  UserRole,
} from "@erichpo/shared";
import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as jwt from "jsonwebtoken";
import { DatabaseService } from "../database";

interface GitHubOAuthTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  error?: string;
  error_description?: string;
}

interface GitHubUser {
  id: number;
  login: string;
  email: string | null;
  avatar_url: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly pendingStates = new Map<string, { createdAt: number }>();

  constructor(
    private readonly configService: ConfigService,
    private readonly db: DatabaseService,
  ) {}

  getGitHubAuthUrl(): string {
    const clientId = this.configService.get<string>("github.clientId");
    if (!clientId) {
      throw new Error("GITHUB_CLIENT_ID not configured");
    }

    const redirectUrl = this.configService.get<string>(
      "github.oauthCallbackUrl",
    );
    const scopes = ["read:user", "user:email"].join(" ");

    // Generate state token for CSRF protection
    const state = crypto.randomUUID();
    this.pendingStates.set(state, { createdAt: Date.now() });

    // Cleanup old states (10 min expiry)
    this.cleanupStates();

    const params = new URLSearchParams({
      client_id: clientId,
      scope: scopes,
      state,
    });

    if (redirectUrl) {
      params.set("redirect_uri", redirectUrl);
    }

    const url = `https://github.com/login/oauth/authorize?${params.toString()}`;
    this.logger.log(`GitHub OAuth redirect, state=${state}`);
    return url;
  }

  validateState(state: string): boolean {
    const pending = this.pendingStates.get(state);
    if (!pending) return false;
    this.pendingStates.delete(state);
    return Date.now() - pending.createdAt < 10 * 60 * 1000;
  }

  async handleCallback(
    code: string,
  ): Promise<{ user: CurrentUser; token: string }> {
    // Exchange code for access token
    const accessToken = await this.exchangeCodeForToken(code);

    // Fetch GitHub user info
    const githubUser = await this.fetchGitHubUser(accessToken);

    // Determine role (check if user is in admin list)
    const role = this.determineUserRole(githubUser.id);

    // Upsert user in database
    const user = await this.db.user.upsert({
      where: { githubId: githubUser.id },
      update: {
        githubUsername: githubUser.login,
        email: githubUser.email,
        avatarUrl: githubUser.avatar_url,
        role,
      },
      create: {
        githubId: githubUser.id,
        githubUsername: githubUser.login,
        email: githubUser.email,
        avatarUrl: githubUser.avatar_url,
        role,
      },
    });

    // Create session
    const sessionMaxAge =
      this.configService.get<number>("auth.sessionMaxAge") ??
      7 * 24 * 60 * 60 * 1000;
    const session = await this.db.session.create({
      data: {
        userId: user.id,
        expiresAt: new Date(Date.now() + sessionMaxAge),
      },
    });

    // Generate JWT
    const token = this.generateJwt(user, session.id);

    this.logger.log(
      `User ${githubUser.login} (${githubUser.id}) logged in, role=${role}`,
    );

    return {
      user: {
        id: user.id,
        githubId: user.githubId,
        githubUsername: user.githubUsername,
        email: user.email,
        avatarUrl: user.avatarUrl,
        role: user.role as UserRole,
        sessionId: session.id,
      },
      token,
    };
  }

  async validateSession(payload: AppJwtPayload): Promise<CurrentUser | null> {
    // Check session is valid and not revoked
    const session = await this.db.session.findUnique({
      where: { id: payload.sid },
      include: { user: true },
    });

    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      return null;
    }

    return {
      id: session.user.id,
      githubId: session.user.githubId,
      githubUsername: session.user.githubUsername,
      email: session.user.email,
      avatarUrl: session.user.avatarUrl,
      role: session.user.role as UserRole,
      sessionId: session.id,
    };
  }

  async logout(sessionId: string): Promise<void> {
    await this.db.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
    this.logger.log(`Session ${sessionId} revoked`);
  }

  async logoutAllSessions(userId: number): Promise<void> {
    const result = await this.db.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    this.logger.log(`Revoked ${result.count} sessions for user ${userId}`);
  }

  private determineUserRole(githubId: number): UserRole {
    const adminIdsStr = this.configService.get<string>("auth.adminGithubIds");
    if (!adminIdsStr) return "user";

    const adminIds = adminIdsStr
      .split(",")
      .map((id) => Number.parseInt(id.trim(), 10))
      .filter((id) => !Number.isNaN(id));

    return adminIds.includes(githubId) ? "admin" : "user";
  }

  private generateJwt(
    user: {
      id: number;
      githubId: number;
      githubUsername: string;
      role: string;
    },
    sessionId: string,
  ): string {
    const secret = this.configService.get<string>("auth.jwtSecret");
    if (!secret) {
      throw new Error("JWT_SECRET not configured");
    }

    const expiresIn =
      this.configService.get<string>("auth.jwtExpiresIn") ?? "7d";

    const payload: Omit<AppJwtPayload, "iat" | "exp"> = {
      sub: user.id,
      sid: sessionId,
      githubId: user.githubId,
      username: user.githubUsername,
      role: user.role as UserRole,
    };

    return jwt.sign(payload, secret, { expiresIn } as jwt.SignOptions);
  }

  verifyJwt(token: string): AppJwtPayload {
    const secret = this.configService.get<string>("auth.jwtSecret");
    if (!secret) {
      throw new Error("JWT_SECRET not configured");
    }

    return jwt.verify(token, secret) as unknown as AppJwtPayload;
  }

  private async exchangeCodeForToken(code: string): Promise<string> {
    const clientId = this.configService.get<string>("github.clientId");
    const clientSecret = this.configService.get<string>("github.clientSecret");

    if (!clientId || !clientSecret) {
      throw new Error("GitHub OAuth credentials not configured");
    }

    const response = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
        }),
      },
    );

    const data: GitHubOAuthTokenResponse = await response.json();
    if (data.error) {
      throw new UnauthorizedException(
        `GitHub OAuth error: ${data.error_description}`,
      );
    }

    return data.access_token;
  }

  private async fetchGitHubUser(accessToken: string): Promise<GitHubUser> {
    const response = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new UnauthorizedException("Failed to fetch GitHub user");
    }

    return response.json();
  }

  private cleanupStates(): void {
    for (const [key, val] of this.pendingStates) {
      if (Date.now() - val.createdAt > 10 * 60 * 1000) {
        this.pendingStates.delete(key);
      }
    }
  }
}
