import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard, Roles, RolesGuard } from "../auth";
import { AdminService } from "./admin.service";

@Controller("api/admin")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin")
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get("workspaces")
  async listWorkspaces() {
    return this.adminService.listWorkspaces();
  }

  @Get("org-mappings")
  async listOrgMappings() {
    return this.adminService.listOrgMappings();
  }

  @Get("slack-users")
  async listSlackUsers(@Query("team_id") teamId?: string) {
    return this.adminService.listSlackUsers(teamId);
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
    @Body()
    body: {
      githubUsername: string;
      slackUserId: string;
      slackWorkspaceId?: number;
    },
  ) {
    return this.adminService.upsertUserMapping(
      body.githubUsername,
      body.slackUserId,
      body.slackWorkspaceId,
    );
  }

  @Get("user-mappings")
  async listUserMappings(@Query("workspace_id") workspaceId?: string) {
    return this.adminService.listUserMappings(
      workspaceId ? Number(workspaceId) : undefined,
    );
  }
}
