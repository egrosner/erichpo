import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { AdminService } from "./admin.service";

@Controller("api/admin")
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get("slack-users")
  async listSlackUsers() {
    return this.adminService.listSlackUsers();
  }

  @Get("github-collaborators/:owner/:repo")
  async listGitHubCollaborators(
    @Param("owner") owner: string,
    @Param("repo") repo: string
  ) {
    return this.adminService.listGitHubCollaborators(owner, repo);
  }

  @Post("user-mappings")
  async createUserMapping(
    @Body() body: { githubUsername: string; slackUserId: string }
  ) {
    return this.adminService.upsertUserMapping(
      body.githubUsername,
      body.slackUserId
    );
  }

  @Get("user-mappings")
  async listUserMappings() {
    return this.adminService.listUserMappings();
  }
}
