import { Controller, Get, Logger, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import { OAuthService } from "./oauth.service";

@Controller("api/oauth/slack")
export class OAuthController {
  private readonly logger = new Logger(OAuthController.name);

  constructor(private readonly oauthService: OAuthService) {}

  @Get("install")
  install(
    @Query("installation_id") installationId: string,
    @Res() res: Response,
  ) {
    if (!installationId) {
      res.status(400).json({ error: "installation_id query param required" });
      return;
    }

    const url = this.oauthService.getInstallUrl(Number(installationId));
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

    // Look up installation_id from server-side state store.
    // If no state is present (direct install from Slack app directory),
    // we still store the workspace but skip OrgMapping creation.
    let installationId: number | null = null;
    if (state) {
      installationId = this.oauthService.getInstallationIdForState(state);
      if (!installationId) {
        this.logger.warn(
          `OAuth callback: could not resolve installation_id from state="${state}" (expired or invalid)`,
        );
      }
    }

    try {
      const result = await this.oauthService.handleCallback(
        code,
        installationId,
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
      });
    } catch (error) {
      this.logger.error(`OAuth callback failed: ${(error as Error).message}`);
      res.status(500).json({
        ok: false,
        error: (error as Error).message,
      });
    }
  }
}
