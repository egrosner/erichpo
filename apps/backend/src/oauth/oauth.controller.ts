import type { CurrentUser } from "@erichpo/shared";
import {
  BadRequestException,
  Controller,
  Get,
  Logger,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { GetCurrentUser, JwtAuthGuard } from "../auth";
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
    @Query("frontend_redirect") frontendRedirect: string | undefined,
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

    const url = this.oauthService.getInstallUrl(
      Number(installationId),
      userId,
      frontendRedirect,
    );
    res.redirect(url);
  }

  @Get("callback")
  async callback(
    @Query("code") code: string,
    @Query("state") state: string,
    @Query("error") oauthError: string,
    @Res() res: Response,
  ) {
    // Look up state data from server-side state store first to get frontendRedirect
    let installationId: number | null = null;
    let userId: number | undefined;
    let frontendRedirect: string | undefined;

    if (state) {
      const stateData = this.oauthService.getStateData(state);
      if (stateData) {
        installationId = stateData.installationId;
        userId = stateData.userId;
        frontendRedirect = stateData.frontendRedirect;
      } else {
        this.logger.warn(
          `OAuth callback: could not resolve state data from state="${state}" (expired or invalid)`,
        );
      }
    }

    // Helper to redirect to frontend with params or return JSON
    const respond = (
      success: boolean,
      data: Record<string, string | number | null>,
    ) => {
      if (frontendRedirect) {
        const url = new URL(frontendRedirect);
        for (const [key, value] of Object.entries(data)) {
          if (value !== null && value !== undefined) {
            url.searchParams.set(key, String(value));
          }
        }
        res.redirect(url.toString());
      } else if (success) {
        res.json({ ok: true, ...data });
      } else {
        res.status(success ? 200 : 400).json({ ok: false, ...data });
      }
    };

    if (oauthError) {
      this.logger.error(`Slack OAuth denied: ${oauthError}`);
      respond(false, {
        workspace_setup: "error",
        error: `Slack OAuth error: ${oauthError}`,
      });
      return;
    }

    if (!code) {
      respond(false, {
        workspace_setup: "error",
        error: "Missing code parameter from Slack",
      });
      return;
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

      if (frontendRedirect) {
        respond(true, {
          workspace_setup: "success",
          workspace_name: result.teamName,
          workspace_id: result.workspaceId,
        });
      } else {
        res.json({
          ok: true,
          message,
          teamId: result.teamId,
          teamName: result.teamName,
          installationId: result.installationId,
          workspaceId: result.workspaceId,
        });
      }
    } catch (error) {
      this.logger.error(`OAuth callback failed: ${(error as Error).message}`);
      respond(false, {
        workspace_setup: "error",
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

  // ========== User OAuth (for Slack impersonation) ==========

  @Get("user/connect")
  @UseGuards(JwtAuthGuard)
  async userConnect(@GetCurrentUser() user: CurrentUser, @Res() res: Response) {
    if (!user.currentWorkspace) {
      throw new BadRequestException("No workspace context set");
    }

    const url = this.oauthService.getUserConnectUrl(
      user.id,
      user.currentWorkspace.workspaceId,
    );
    res.redirect(url);
  }

  @Get("user/callback")
  async userCallback(
    @Query("code") code: string,
    @Query("state") state: string,
    @Query("error") oauthError: string,
    @Res() res: Response,
  ) {
    const frontendUrl = "/dashboard";

    if (oauthError) {
      this.logger.error(`Slack user OAuth denied: ${oauthError}`);
      res.redirect(
        `${frontendUrl}?slack_connect_error=${encodeURIComponent(oauthError)}`,
      );
      return;
    }

    if (!code || !state) {
      res.redirect(`${frontendUrl}?slack_connect_error=missing_params`);
      return;
    }

    const stateData = this.oauthService.getUserStateData(state);
    if (!stateData) {
      this.logger.warn(
        `User OAuth callback: invalid or expired state="${state}"`,
      );
      res.redirect(`${frontendUrl}?slack_connect_error=invalid_state`);
      return;
    }

    try {
      const result = await this.oauthService.handleUserCallback(
        code,
        stateData.userId,
        stateData.workspaceId,
      );

      this.logger.log(
        `User ${stateData.userId} connected Slack in workspace ${stateData.workspaceId}`,
      );

      res.redirect(`${frontendUrl}?slack_connected=true`);
    } catch (error) {
      this.logger.error(
        `User OAuth callback failed: ${(error as Error).message}`,
      );
      res.redirect(
        `${frontendUrl}?slack_connect_error=${encodeURIComponent((error as Error).message)}`,
      );
    }
  }

  @Post("user/disconnect")
  @UseGuards(JwtAuthGuard)
  async userDisconnect(
    @GetCurrentUser() user: CurrentUser,
  ): Promise<{ ok: boolean }> {
    if (!user.currentWorkspace) {
      throw new BadRequestException("No workspace context set");
    }

    await this.oauthService.disconnectSlackUser(
      user.id,
      user.currentWorkspace.workspaceId,
    );

    return { ok: true };
  }
}
