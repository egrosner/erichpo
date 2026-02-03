import { Controller, Get, Param, Req, Res } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request, Response } from "express";
import { Public } from "../auth";
import { InviteService } from "./invite.service";

@Controller("api/invite")
export class InviteController {
  constructor(
    private readonly inviteService: InviteService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Get("complete")
  async completeInvite(@Req() req: Request, @Res() res: Response) {
    const pendingInviteToken = req.cookies?.pending_invite_token;
    const authToken = req.cookies?.auth_token;

    this.clearPendingInviteCookie(res);

    if (!pendingInviteToken || !authToken) {
      return res.redirect("/dashboard");
    }

    const user = await this.inviteService.getUserFromAuthToken(authToken);
    if (!user) {
      return this.redirectWithError(res, "Session expired");
    }

    try {
      const result = await this.inviteService.redeemInviteForUser(
        pendingInviteToken,
        user,
      );
      this.setAuthCookie(res, result.newAuthToken);
      return this.redirectWithSuccess(res, result.workspaceName);
    } catch (err) {
      return this.redirectWithError(
        res,
        (err as Error).message || "Failed to join workspace",
      );
    }
  }

  @Public()
  @Get(":token")
  async handleInvite(
    @Param("token") token: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const validation = await this.inviteService.validateInviteToken(token);

    if (!validation.valid) {
      return this.redirectWithError(
        res,
        this.inviteService.getValidationErrorMessage(validation.error),
      );
    }

    const authToken = req.cookies?.auth_token;
    const user = authToken
      ? await this.inviteService.getUserFromAuthToken(authToken)
      : null;

    if (user) {
      try {
        const result = await this.inviteService.redeemInviteForUser(
          token,
          user,
        );
        this.setAuthCookie(res, result.newAuthToken);
        return this.redirectWithSuccess(res, result.workspaceName);
      } catch (err) {
        return this.redirectWithError(
          res,
          (err as Error).message || "Failed to join workspace",
        );
      }
    }

    this.setPendingInviteCookie(res, token);
    return res.redirect("/api/auth/github");
  }

  private setAuthCookie(res: Response, token: string) {
    res.cookie("auth_token", token, {
      httpOnly: true,
      secure: this.configService.get<boolean>("auth.cookieSecure") ?? true,
      sameSite: "lax",
      maxAge:
        this.configService.get<number>("auth.sessionMaxAge") ??
        7 * 24 * 60 * 60 * 1000,
      path: "/",
    });
  }

  private setPendingInviteCookie(res: Response, token: string) {
    res.cookie("pending_invite_token", token, {
      httpOnly: true,
      secure: this.configService.get<boolean>("auth.cookieSecure") ?? true,
      sameSite: "lax",
      maxAge: 10 * 60 * 1000,
      path: "/",
    });
  }

  private clearPendingInviteCookie(res: Response) {
    res.clearCookie("pending_invite_token", { path: "/" });
  }

  private redirectWithSuccess(res: Response, workspaceName: string) {
    return res.redirect(
      `/dashboard?invited=${encodeURIComponent(workspaceName)}`,
    );
  }

  private redirectWithError(res: Response, message: string) {
    return res.redirect(
      `/dashboard?invite_error=${encodeURIComponent(message)}`,
    );
  }
}
