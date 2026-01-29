import type { CurrentUser } from "@erichpo/shared";
import { Controller, Get, Query, Res, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Response } from "express";
import { AuthService } from "./auth.service";
import { GetCurrentUser } from "./decorators/current-user.decorator";
import { Public } from "./decorators/public.decorator";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";

@Controller("api/auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
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
    @Res() res: Response,
  ) {
    if (error) {
      return res.redirect(`/?error=${encodeURIComponent(error)}`);
    }

    if (!code || !this.authService.validateState(state)) {
      return res.redirect("/?error=invalid_request");
    }

    try {
      const { token } = await this.authService.handleCallback(code);

      const isSecure =
        this.configService.get<boolean>("auth.cookieSecure") ?? true;
      const sessionMaxAge =
        this.configService.get<number>("auth.sessionMaxAge") ??
        7 * 24 * 60 * 60 * 1000;

      // Set JWT as HTTP-only cookie
      res.cookie("auth_token", token, {
        httpOnly: true,
        secure: isSecure,
        sameSite: "lax",
        maxAge: sessionMaxAge,
        path: "/",
      });

      // Redirect to dashboard
      res.redirect("/dashboard");
    } catch (err) {
      res.redirect(`/?error=${encodeURIComponent((err as Error).message)}`);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  me(@GetCurrentUser() user: CurrentUser) {
    return user;
  }

  @UseGuards(JwtAuthGuard)
  @Get("logout")
  async logout(@GetCurrentUser() user: CurrentUser, @Res() res: Response) {
    await this.authService.logout(user.sessionId);
    res.clearCookie("auth_token", { path: "/" });
    res.redirect("/");
  }
}
