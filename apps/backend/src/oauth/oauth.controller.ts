import type { CurrentUser } from "@erichpo/shared";
import { Controller, Get, Logger, Query, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { AuthService } from "../auth/auth.service";
import { OAuthService } from "./oauth.service";

@Controller("api/oauth/slack")
export class OAuthController {
  private readonly logger = new Logger(OAuthController.name);

  constructor(
    private readonly oauthService: OAuthService,
    private readonly authService: AuthService,
  ) {}

  @Get("install")
  async install(
    @Query("installation_id") installationId: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!installationId) {
      res.status(400).json({ error: "installation_id query param required" });
      return;
    }

    // Try to get the current user from the auth token
    let userId: number | undefined;
    try {
      const token = this.extractToken(req);
      if (token) {
        const payload = this.authService.verifyJwt(token);
        const user = await this.authService.validateSession(payload);
        if (user) {
          userId = user.id;
        }
      }
    } catch {
      // No valid auth token, proceed without user ID
    }

    const url = this.oauthService.getInstallUrl(Number(installationId), userId);
    res.redirect(url);
  }

  @Get("callback")
  async callback(
    @Query("code") code: string,
    @Query("state") state: string,
    @Query("error") oauthError: string,
    @Res() res: Response,
  ) {
    if (oauthError) {
      this.logger.error(`Slack OAuth denied: ${oauthError}`);
      res
        .status(400)
        .json({ ok: false, error: `Slack OAuth error: ${oauthError}` });
      return;
    }

    if (!code) {
      res.status(400).json({ error: "Missing code parameter from Slack" });
      return;
    }

    // Look up state data from server-side state store.
    // If no state is present (direct install from Slack app directory),
    // we still store the workspace but skip OrgMapping creation and membership.
    let installationId: number | null = null;
    let userId: number | undefined;

    if (state) {
      const stateData = this.oauthService.getStateData(state);
      if (stateData) {
        installationId = stateData.installationId;
        userId = stateData.userId;
      } else {
        this.logger.warn(
          `OAuth callback: could not resolve state data from state="${state}" (expired or invalid)`,
        );
      }
    }

    try {
      const result = await this.oauthService.handleCallback(
        code,
        installationId,
        userId,
      );

      const message = result.installationId
        ? `Successfully connected workspace "${result.teamName}" to GitHub installation ${result.installationId}`
        : `Successfully registered workspace "${result.teamName}". Link it to a GitHub installation via /api/oauth/slack/install?installation_id=X`;

      res.json({
        ok: true,
        message,
        teamId: result.teamId,
        teamName: result.teamName,
        installationId: result.installationId,
        workspaceId: result.workspaceId,
      });
    } catch (error) {
      this.logger.error(`OAuth callback failed: ${(error as Error).message}`);
      res.status(500).json({
        ok: false,
        error: (error as Error).message,
      });
    }
  }

  private extractToken(request: Request): string | null {
    // Try cookie first
    const cookieToken = request.cookies?.auth_token;
    if (cookieToken) return cookieToken;

    // Fall back to Authorization header (for API clients)
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      return authHeader.slice(7);
    }

    return null;
  }
}
