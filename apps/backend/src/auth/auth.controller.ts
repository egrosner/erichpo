import type { CurrentUser } from "@erichpo/shared";
import {
  Body,
  Controller,
  Get,
  Logger,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request, Response } from "express";
import { DatabaseService } from "../database";
import { AuthService } from "./auth.service";
import { GetCurrentUser } from "./decorators/current-user.decorator";
import { Public } from "./decorators/public.decorator";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";

interface GitHubSetupState {
  intent: "link" | "new_workspace";
  workspaceId?: number;
  returnTo?: string;
}

@Controller("api/auth")
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly db: DatabaseService,
  ) {}

  @Public()
  @Get("github")
  login(@Res() res: Response) {
    const url = this.authService.getGitHubAuthUrl();
    res.redirect(url);
  }

  @Public()
  @Get("github/callback")
  async callback(
    @Query("code") code: string,
    @Query("state") state: string,
    @Query("error") error: string,
    @Query("installation_id") installationId: string | undefined,
    @Query("setup_action") setupAction: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (error) {
      return res.redirect(`/?error=${encodeURIComponent(error)}`);
    }

    // Check if this is a GitHub App installation callback
    // When "Request user authorization during installation" is enabled,
    // GitHub redirects here with installation_id and setup_action=install
    const isAppInstallation = installationId && setupAction === "install";

    // For app installations, we decode our custom state instead of validating OAuth state
    let setupState: GitHubSetupState | null = null;
    if (isAppInstallation && state) {
      try {
        const decoded = Buffer.from(state, "base64").toString("utf-8");
        setupState = JSON.parse(decoded) as GitHubSetupState;
        this.logger.log(
          `GitHub App installation callback: installation_id=${installationId}, intent=${setupState.intent}`,
        );
      } catch {
        this.logger.warn(
          `Failed to decode state in app installation: ${state}`,
        );
      }
    }

    // For regular OAuth, validate the state
    if (
      !isAppInstallation &&
      (!code || !this.authService.validateState(state))
    ) {
      return res.redirect("/?error=invalid_request");
    }

    const isSecure =
      this.configService.get<boolean>("auth.cookieSecure") ?? true;
    const sessionMaxAge =
      this.configService.get<number>("auth.sessionMaxAge") ??
      7 * 24 * 60 * 60 * 1000;

    try {
      const { token, user } = await this.authService.handleCallback(code);

      // Set JWT as HTTP-only cookie
      res.cookie("auth_token", token, {
        httpOnly: true,
        secure: isSecure,
        sameSite: "lax",
        maxAge: sessionMaxAge,
        path: "/",
      });

      // Check for pending invite token - if present, redirect to invite completion
      const pendingInviteToken = req.cookies?.pending_invite_token;
      if (pendingInviteToken) {
        return res.redirect("/api/invite/complete");
      }

      // Handle GitHub App installation if this callback came from app install
      if (isAppInstallation && setupState) {
        const installationIdNum = Number(installationId);
        return this.handleAppInstallation(
          res,
          user,
          installationIdNum,
          setupState,
        );
      }

      // Redirect to dashboard
      res.redirect("/dashboard");
    } catch (err) {
      res.redirect(`/?error=${encodeURIComponent((err as Error).message)}`);
    }
  }

  /**
   * Handles GitHub App installation after OAuth completes.
   * Called when user installs the app with "Request user authorization" enabled.
   */
  private async handleAppInstallation(
    res: Response,
    user: CurrentUser,
    installationId: number,
    state: GitHubSetupState,
  ): Promise<void> {
    const returnTo = state.returnTo ?? "/dashboard";

    if (state.intent === "link" && state.workspaceId) {
      // Link intent: create OrgMapping if user is admin of the workspace
      const membership = await this.db.workspaceMembership.findUnique({
        where: {
          userId_slackWorkspaceId: {
            userId: user.id,
            slackWorkspaceId: state.workspaceId,
          },
        },
      });

      if (!membership || membership.role !== "admin") {
        res.redirect(
          `${returnTo}?github_setup_error=${encodeURIComponent("You must be a workspace admin to link organizations")}`,
        );
        return;
      }

      // Check if installation is already linked
      const existing = await this.db.orgMapping.findUnique({
        where: { githubInstallationId: installationId },
      });

      if (existing) {
        res.redirect(
          `${returnTo}?github_setup_error=${encodeURIComponent("This GitHub installation is already linked to a workspace")}`,
        );
        return;
      }

      // Create the org mapping
      await this.db.orgMapping.create({
        data: {
          githubInstallationId: installationId,
          slackWorkspaceId: state.workspaceId,
        },
      });

      this.logger.log(
        `Linked GitHub installation ${installationId} to workspace ${state.workspaceId} via OAuth callback`,
      );

      res.redirect(`${returnTo}?github_linked=success`);
      return;
    }

    // Default: new_workspace intent - redirect to wizard with installation pre-selected
    const targetUrl = state.returnTo ?? "/no-workspace";
    res.redirect(`${targetUrl}?github_setup=${installationId}`);
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  me(@GetCurrentUser() user: CurrentUser) {
    return user;
  }

  @UseGuards(JwtAuthGuard)
  @Post("switch-workspace")
  async switchWorkspace(
    @GetCurrentUser() user: CurrentUser,
    @Body() body: { workspaceId: number },
    @Res() res: Response,
  ) {
    const { token, user: updatedUser } = await this.authService.switchWorkspace(
      user.id,
      user.sessionId,
      body.workspaceId,
    );

    const isSecure =
      this.configService.get<boolean>("auth.cookieSecure") ?? true;
    const sessionMaxAge =
      this.configService.get<number>("auth.sessionMaxAge") ??
      7 * 24 * 60 * 60 * 1000;

    // Update JWT cookie with new workspace context
    res.cookie("auth_token", token, {
      httpOnly: true,
      secure: isSecure,
      sameSite: "lax",
      maxAge: sessionMaxAge,
      path: "/",
    });

    res.json(updatedUser);
  }

  @UseGuards(JwtAuthGuard)
  @Get("logout")
  async logout(@GetCurrentUser() user: CurrentUser, @Res() res: Response) {
    await this.authService.logout(user.sessionId);
    res.clearCookie("auth_token", { path: "/" });
    res.redirect("/");
  }
}
