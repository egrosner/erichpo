import type { CurrentUser, WorkspaceRole } from "@erichpo/shared";
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  GetCurrentUser,
  JwtAuthGuard,
  WorkspaceRoles,
  WorkspaceRolesGuard,
} from "../auth";
import type { InviteService } from "../invite/invite.service";
import type { AdminService } from "./admin.service";

@Controller("api/admin")
@UseGuards(JwtAuthGuard, WorkspaceRolesGuard)
@WorkspaceRoles("admin")
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly inviteService: InviteService,
  ) {}

  @Get("workspace")
  async getWorkspace(@GetCurrentUser() user: CurrentUser) {
    if (!user.currentWorkspace) {
      throw new BadRequestException("No workspace context set");
    }
    return this.adminService.getWorkspace(user.currentWorkspace.workspaceId);
  }

  @Get("org-mappings")
  async listOrgMappings(@GetCurrentUser() user: CurrentUser) {
    if (!user.currentWorkspace) {
      throw new BadRequestException("No workspace context set");
    }
    return this.adminService.listOrgMappingsForWorkspace(
      user.currentWorkspace.workspaceId,
    );
  }

  @Post("org-mappings")
  async createOrgMapping(
    @GetCurrentUser() user: CurrentUser,
    @Body() body: { installationId: number },
  ) {
    if (!user.currentWorkspace) {
      throw new BadRequestException("No workspace context set");
    }
    return this.adminService.createOrgMapping(
      user.currentWorkspace.workspaceId,
      body.installationId,
    );
  }

  @Delete("org-mappings/:installationId")
  async deleteOrgMapping(
    @GetCurrentUser() user: CurrentUser,
    @Param("installationId", ParseIntPipe) installationId: number,
  ) {
    if (!user.currentWorkspace) {
      throw new BadRequestException("No workspace context set");
    }
    return this.adminService.deleteOrgMapping(
      user.currentWorkspace.workspaceId,
      installationId,
    );
  }

  @Get("slack-users")
  async listSlackUsers(@GetCurrentUser() user: CurrentUser) {
    if (!user.currentWorkspace) {
      throw new BadRequestException("No workspace context set");
    }
    return this.adminService.listSlackUsers(user.currentWorkspace.teamId);
  }

  @Get("github-collaborators/:owner/:repo")
  async listGitHubCollaborators(
    @Param("owner") owner: string,
    @Param("repo") repo: string,
  ) {
    return this.adminService.listGitHubCollaborators(owner, repo);
  }

  @Post("user-mappings")
  async createUserMapping(
    @GetCurrentUser() user: CurrentUser,
    @Body()
    body: {
      githubUsername: string;
      slackUserId: string;
    },
  ) {
    if (!user.currentWorkspace) {
      throw new BadRequestException("No workspace context set");
    }
    return this.adminService.upsertUserMapping(
      body.githubUsername,
      body.slackUserId,
      user.currentWorkspace.workspaceId,
    );
  }

  @Get("user-mappings")
  async listUserMappings(@GetCurrentUser() user: CurrentUser) {
    if (!user.currentWorkspace) {
      throw new BadRequestException("No workspace context set");
    }
    return this.adminService.listUserMappings(
      user.currentWorkspace.workspaceId,
    );
  }

  @Delete("user-mappings/:githubUsername")
  async deleteUserMapping(
    @GetCurrentUser() user: CurrentUser,
    @Param("githubUsername") githubUsername: string,
  ) {
    if (!user.currentWorkspace) {
      throw new BadRequestException("No workspace context set");
    }
    return this.adminService.deleteUserMapping(
      githubUsername,
      user.currentWorkspace.workspaceId,
    );
  }

  // Workspace member management endpoints

  @Get("members")
  async listMembers(@GetCurrentUser() user: CurrentUser) {
    if (!user.currentWorkspace) {
      return [];
    }
    return this.adminService.listWorkspaceMembers(
      user.currentWorkspace.workspaceId,
    );
  }

  @Post("members/invite")
  async inviteMember(
    @GetCurrentUser() user: CurrentUser,
    @Body() body: { githubUsername: string; role?: WorkspaceRole },
  ) {
    if (!user.currentWorkspace) {
      throw new BadRequestException("No workspace context set");
    }
    return this.adminService.inviteUserToWorkspace(
      user.currentWorkspace.workspaceId,
      body.githubUsername,
      body.role ?? "user",
    );
  }

  @Patch("members/:userId/role")
  async updateMemberRole(
    @GetCurrentUser() user: CurrentUser,
    @Param("userId", ParseIntPipe) targetUserId: number,
    @Body() body: { role: WorkspaceRole },
  ) {
    if (!user.currentWorkspace) {
      throw new BadRequestException("No workspace context set");
    }
    return this.adminService.updateMemberRole(
      user.currentWorkspace.workspaceId,
      targetUserId,
      body.role,
      user.id,
    );
  }

  @Delete("members/:userId")
  async removeMember(
    @GetCurrentUser() user: CurrentUser,
    @Param("userId", ParseIntPipe) targetUserId: number,
  ) {
    if (!user.currentWorkspace) {
      throw new BadRequestException("No workspace context set");
    }
    return this.adminService.removeMember(
      user.currentWorkspace.workspaceId,
      targetUserId,
      user.id,
    );
  }

  // Invite link endpoints

  @Post("invite-links")
  async createInviteLink(@GetCurrentUser() user: CurrentUser) {
    if (!user.currentWorkspace) {
      throw new BadRequestException("No workspace context set");
    }
    return this.inviteService.createInviteLink(
      user.currentWorkspace.workspaceId,
      user.id,
    );
  }

  @Get("invite-links")
  async listInviteLinks(@GetCurrentUser() user: CurrentUser) {
    if (!user.currentWorkspace) {
      throw new BadRequestException("No workspace context set");
    }
    return this.inviteService.listInviteLinks(
      user.currentWorkspace.workspaceId,
    );
  }

  @Delete("workspace")
  async deleteWorkspace(@GetCurrentUser() user: CurrentUser) {
    if (!user.currentWorkspace) {
      throw new BadRequestException("No workspace context set");
    }
    return this.adminService.deleteWorkspace(user.currentWorkspace.workspaceId);
  }

  @Delete("invite-links/:id")
  async deleteInviteLink(
    @GetCurrentUser() user: CurrentUser,
    @Param("id", ParseIntPipe) id: number,
  ) {
    if (!user.currentWorkspace) {
      throw new BadRequestException("No workspace context set");
    }
    return this.inviteService.deleteInviteLink(
      id,
      user.currentWorkspace.workspaceId,
    );
  }
}
