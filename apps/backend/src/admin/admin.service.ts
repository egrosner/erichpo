import type { WorkspaceRole } from "@erichpo/shared";
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { DatabaseService } from "../database";
import { GitHubService } from "../github/github.service";
import { SlackService } from "../slack/slack.service";

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly slackService: SlackService,
    private readonly githubService: GitHubService,
    private readonly db: DatabaseService,
  ) {}

  async getWorkspace(workspaceId: number) {
    const workspace = await this.db.slackWorkspace.findUnique({
      where: { id: workspaceId },
      select: {
        id: true,
        teamId: true,
        teamName: true,
        botUserId: true,
        installedBy: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!workspace) {
      throw new NotFoundException("Workspace not found");
    }

    return workspace;
  }

  async listOrgMappingsForWorkspace(workspaceId: number) {
    return this.db.orgMapping.findMany({
      where: { slackWorkspaceId: workspaceId },
      include: {
        slackWorkspace: {
          select: { teamId: true, teamName: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async createOrgMapping(workspaceId: number, installationId: number) {
    // Check if this installation is already linked to any workspace
    const existing = await this.db.orgMapping.findUnique({
      where: { githubInstallationId: installationId },
      include: { slackWorkspace: { select: { teamName: true } } },
    });

    if (existing) {
      throw new BadRequestException(
        `This GitHub installation is already linked to workspace "${existing.slackWorkspace.teamName}"`,
      );
    }

    // Create the mapping
    const mapping = await this.db.orgMapping.create({
      data: {
        githubInstallationId: installationId,
        slackWorkspaceId: workspaceId,
      },
      include: {
        slackWorkspace: {
          select: { teamId: true, teamName: true },
        },
      },
    });

    this.logger.log(
      `Linked GitHub installation ${installationId} to workspace ${workspaceId}`,
    );

    return mapping;
  }

  async deleteOrgMapping(workspaceId: number, installationId: number) {
    const mapping = await this.db.orgMapping.findFirst({
      where: {
        githubInstallationId: installationId,
        slackWorkspaceId: workspaceId,
      },
    });

    if (!mapping) {
      throw new NotFoundException(
        "This GitHub installation is not linked to your workspace",
      );
    }

    await this.db.orgMapping.delete({
      where: { id: mapping.id },
    });

    this.logger.log(
      `Unlinked GitHub installation ${installationId} from workspace ${workspaceId}`,
    );

    return { success: true };
  }

  async listSlackUsers(teamId: string) {
    return this.slackService.listUsers(teamId);
  }

  async listGitHubCollaborators(owner: string, repo: string) {
    const installationId = await this.githubService.getInstallationForRepo(
      owner,
      repo,
    );
    return this.githubService.getCollaborators(owner, repo, installationId);
  }

  async upsertUserMapping(
    githubUsername: string,
    slackUserId: string,
    slackWorkspaceId: number,
  ) {
    const existing = await this.db.gitHubSlackUserMapping.findFirst({
      where: {
        githubUsername,
        slackWorkspaceId,
      },
    });

    const mapping = existing
      ? await this.db.gitHubSlackUserMapping.update({
          where: { id: existing.id },
          data: { slackUserId },
        })
      : await this.db.gitHubSlackUserMapping.create({
          data: { githubUsername, slackUserId, slackWorkspaceId },
        });

    this.logger.log(
      `Mapped GitHub user ${githubUsername} to Slack user ${slackUserId} (workspace ${slackWorkspaceId})`,
    );

    return mapping;
  }

  async listUserMappings(slackWorkspaceId: number) {
    return this.db.gitHubSlackUserMapping.findMany({
      where: { slackWorkspaceId },
      orderBy: { githubUsername: "asc" },
    });
  }

  async deleteUserMapping(githubUsername: string, slackWorkspaceId: number) {
    const mapping = await this.db.gitHubSlackUserMapping.findFirst({
      where: {
        githubUsername,
        slackWorkspaceId,
      },
    });

    if (!mapping) {
      throw new NotFoundException(
        `No mapping found for GitHub user "${githubUsername}" in this workspace`,
      );
    }

    await this.db.gitHubSlackUserMapping.delete({
      where: { id: mapping.id },
    });

    this.logger.log(
      `Deleted mapping for GitHub user ${githubUsername} (workspace ${slackWorkspaceId})`,
    );

    return { success: true };
  }

  // Workspace member management

  async listWorkspaceMembers(workspaceId: number) {
    const members = await this.db.workspaceMembership.findMany({
      where: { slackWorkspaceId: workspaceId },
      include: {
        user: {
          select: {
            id: true,
            githubId: true,
            githubUsername: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return members.map((m) => ({
      userId: m.user.id,
      githubId: m.user.githubId,
      githubUsername: m.user.githubUsername,
      email: m.user.email,
      avatarUrl: m.user.avatarUrl,
      role: m.role as WorkspaceRole,
      joinedAt: m.createdAt,
    }));
  }

  async inviteUserToWorkspace(
    workspaceId: number,
    githubUsername: string,
    role: WorkspaceRole = "user",
  ) {
    // Find the user by GitHub username
    const user = await this.db.user.findFirst({
      where: { githubUsername },
    });

    if (!user) {
      throw new NotFoundException(
        `User with GitHub username "${githubUsername}" not found. They must log in at least once before they can be invited.`,
      );
    }

    // Check if user is already a member
    const existing = await this.db.workspaceMembership.findUnique({
      where: {
        userId_slackWorkspaceId: {
          userId: user.id,
          slackWorkspaceId: workspaceId,
        },
      },
    });

    if (existing) {
      throw new BadRequestException(
        `User "${githubUsername}" is already a member of this workspace`,
      );
    }

    // Create membership
    const membership = await this.db.workspaceMembership.create({
      data: {
        userId: user.id,
        slackWorkspaceId: workspaceId,
        role,
      },
    });

    this.logger.log(
      `Invited user ${githubUsername} (${user.id}) to workspace ${workspaceId} as ${role}`,
    );

    return {
      userId: user.id,
      githubId: user.githubId,
      githubUsername: user.githubUsername,
      email: user.email,
      avatarUrl: user.avatarUrl,
      role: membership.role as WorkspaceRole,
      joinedAt: membership.createdAt,
    };
  }

  async updateMemberRole(
    workspaceId: number,
    targetUserId: number,
    newRole: WorkspaceRole,
    requestingUserId: number,
  ) {
    // Verify target user is a member
    const membership = await this.db.workspaceMembership.findUnique({
      where: {
        userId_slackWorkspaceId: {
          userId: targetUserId,
          slackWorkspaceId: workspaceId,
        },
      },
      include: { user: true },
    });

    if (!membership) {
      throw new NotFoundException("User is not a member of this workspace");
    }

    // Prevent demoting the last admin
    if (membership.role === "admin" && newRole === "user") {
      const adminCount = await this.db.workspaceMembership.count({
        where: { slackWorkspaceId: workspaceId, role: "admin" },
      });

      if (adminCount <= 1) {
        throw new BadRequestException(
          "Cannot demote the last admin. Promote another user to admin first.",
        );
      }
    }

    // Update role
    const updated = await this.db.workspaceMembership.update({
      where: {
        userId_slackWorkspaceId: {
          userId: targetUserId,
          slackWorkspaceId: workspaceId,
        },
      },
      data: { role: newRole },
    });

    this.logger.log(
      `Updated role for user ${membership.user.githubUsername} (${targetUserId}) in workspace ${workspaceId} to ${newRole} (by user ${requestingUserId})`,
    );

    return {
      userId: membership.user.id,
      githubId: membership.user.githubId,
      githubUsername: membership.user.githubUsername,
      email: membership.user.email,
      avatarUrl: membership.user.avatarUrl,
      role: updated.role as WorkspaceRole,
      joinedAt: membership.createdAt,
    };
  }

  async removeMember(
    workspaceId: number,
    targetUserId: number,
    requestingUserId: number,
  ) {
    // Prevent self-removal
    if (targetUserId === requestingUserId) {
      throw new BadRequestException(
        "You cannot remove yourself from the workspace",
      );
    }

    // Verify target user is a member
    const membership = await this.db.workspaceMembership.findUnique({
      where: {
        userId_slackWorkspaceId: {
          userId: targetUserId,
          slackWorkspaceId: workspaceId,
        },
      },
      include: { user: true },
    });

    if (!membership) {
      throw new NotFoundException("User is not a member of this workspace");
    }

    // Prevent removing the last admin
    if (membership.role === "admin") {
      const adminCount = await this.db.workspaceMembership.count({
        where: { slackWorkspaceId: workspaceId, role: "admin" },
      });

      if (adminCount <= 1) {
        throw new BadRequestException(
          "Cannot remove the last admin. Promote another user to admin first.",
        );
      }
    }

    // Delete membership
    await this.db.workspaceMembership.delete({
      where: {
        userId_slackWorkspaceId: {
          userId: targetUserId,
          slackWorkspaceId: workspaceId,
        },
      },
    });

    this.logger.log(
      `Removed user ${membership.user.githubUsername} (${targetUserId}) from workspace ${workspaceId} (by user ${requestingUserId})`,
    );

    return { success: true };
  }
}
