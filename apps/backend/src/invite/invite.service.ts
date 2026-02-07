import type { CurrentUser } from "@erichpo/shared";
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { AuthService } from "../auth";
import { DatabaseService } from "../database";

const INVITE_EXPIRY_DAYS = 7;

type InviteValidation =
  | { valid: false; error: "invalid" | "max_uses_reached" | "expired" }
  | {
      valid: true;
      invite: {
        id: number;
        token: string;
        workspaceId: number;
        teamId: string;
        workspaceName: string;
      };
    };

@Injectable()
export class InviteService {
  private readonly logger = new Logger(InviteService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly authService: AuthService,
  ) {}

  async createInviteLink(
    workspaceId: number,
    createdById: number,
    maxUses?: number | null,
  ) {
    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRY_DAYS);

    const invite = await this.db.inviteLink.create({
      data: {
        token,
        expiresAt,
        maxUses: maxUses ?? null,
        slackWorkspaceId: workspaceId,
        createdById,
      },
      include: {
        slackWorkspace: {
          select: { teamName: true },
        },
        createdBy: {
          select: { githubUsername: true },
        },
      },
    });

    this.logger.log(
      `Created invite link for workspace ${workspaceId} by user ${createdById} (maxUses: ${maxUses ?? "unlimited"})`,
    );

    return {
      id: invite.id,
      token: invite.token,
      expiresAt: invite.expiresAt,
      createdAt: invite.createdAt,
      maxUses: invite.maxUses,
      workspaceName: invite.slackWorkspace.teamName,
      createdBy: invite.createdBy.githubUsername,
    };
  }

  async validateInviteToken(token: string): Promise<InviteValidation> {
    const invite = await this.db.inviteLink.findUnique({
      where: { token },
      include: {
        slackWorkspace: {
          select: { id: true, teamId: true, teamName: true },
        },
        _count: {
          select: { usages: true },
        },
      },
    });

    if (!invite) {
      return { valid: false, error: "invalid" };
    }

    if (invite.maxUses !== null && invite._count.usages >= invite.maxUses) {
      return { valid: false, error: "max_uses_reached" };
    }

    if (invite.expiresAt < new Date()) {
      return { valid: false, error: "expired" };
    }

    return {
      valid: true,
      invite: {
        id: invite.id,
        token: invite.token,
        workspaceId: invite.slackWorkspaceId,
        teamId: invite.slackWorkspace.teamId,
        workspaceName: invite.slackWorkspace.teamName,
      },
    };
  }

  getValidationErrorMessage(error: "invalid" | "max_uses_reached" | "expired") {
    switch (error) {
      case "invalid":
        return "Invalid invite link";
      case "max_uses_reached":
        return "This invite link has reached its maximum number of uses";
      case "expired":
        return "This invite link has expired";
    }
  }

  async getUserFromAuthToken(authToken: string): Promise<CurrentUser | null> {
    try {
      const payload = this.authService.verifyJwt(authToken);
      return this.authService.validateSession(payload);
    } catch {
      return null;
    }
  }

  async redeemInviteForUser(
    token: string,
    user: CurrentUser,
  ): Promise<{ workspaceName: string; newAuthToken: string }> {
    const result = await this.redeemInvite(token, user.id);

    const { token: newAuthToken } = await this.authService.switchWorkspace(
      user.id,
      user.sessionId,
      result.workspaceId,
    );

    return {
      workspaceName: result.workspaceName,
      newAuthToken,
    };
  }

  async listInviteLinks(workspaceId: number) {
    const invites = await this.db.inviteLink.findMany({
      where: { slackWorkspaceId: workspaceId },
      include: {
        createdBy: {
          select: { githubUsername: true },
        },
        _count: {
          select: { usages: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return invites.map((invite) => ({
      id: invite.id,
      token: invite.token,
      expiresAt: invite.expiresAt,
      createdAt: invite.createdAt,
      maxUses: invite.maxUses,
      useCount: invite._count.usages,
      createdBy: invite.createdBy.githubUsername,
      status:
        invite.maxUses !== null && invite._count.usages >= invite.maxUses
          ? "exhausted"
          : invite.expiresAt < new Date()
            ? "expired"
            : "active",
    }));
  }

  async deleteInviteLink(id: number, workspaceId: number) {
    const invite = await this.db.inviteLink.findFirst({
      where: { id, slackWorkspaceId: workspaceId },
    });

    if (!invite) {
      throw new NotFoundException("Invite link not found");
    }

    await this.db.inviteLink.delete({
      where: { id },
    });

    this.logger.log(`Deleted invite link ${id} from workspace ${workspaceId}`);

    return { success: true };
  }

  private async redeemInvite(token: string, userId: number) {
    const validation = await this.validateInviteToken(token);

    if (!validation.valid) {
      throw new BadRequestException(
        this.getValidationErrorMessage(validation.error),
      );
    }

    const { invite } = validation;

    const existingMembership = await this.db.workspaceMembership.findUnique({
      where: {
        userId_slackWorkspaceId: {
          userId,
          slackWorkspaceId: invite.workspaceId,
        },
      },
    });

    if (existingMembership) {
      throw new BadRequestException(
        "You are already a member of this workspace",
      );
    }

    const result = await this.db.$transaction(async (tx) => {
      await tx.inviteLinkUsage.create({
        data: {
          inviteLinkId: invite.id,
          userId,
        },
      });

      const membership = await tx.workspaceMembership.create({
        data: {
          userId,
          slackWorkspaceId: invite.workspaceId,
          role: "user",
        },
      });

      return membership;
    });

    this.logger.log(
      `User ${userId} redeemed invite for workspace ${invite.workspaceId}`,
    );

    return {
      workspaceId: invite.workspaceId,
      workspaceName: invite.workspaceName,
      teamId: invite.teamId,
      role: result.role,
    };
  }
}
