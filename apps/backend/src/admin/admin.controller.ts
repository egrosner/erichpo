import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Post,
} from "@nestjs/common";
import { DatabaseService } from "../database";
import { GitHubService } from "../github/github.service";
import { SlackService } from "../slack/slack.service";

@Controller("api/admin")
export class AdminController {
  private readonly logger = new Logger(AdminController.name);

  constructor(
    private readonly slackService: SlackService,
    private readonly githubService: GitHubService,
    private readonly db: DatabaseService
  ) {}

  @Get("slack-users")
  async listSlackUsers() {
    return this.slackService.listUsers();
  }

  @Get("github-collaborators/:owner/:repo")
  async listGitHubCollaborators(
    @Param("owner") owner: string,
    @Param("repo") repo: string
  ) {
    const installationId =
      await this.githubService.getInstallationForRepo(owner, repo);
    return this.githubService.getCollaborators(owner, repo, installationId);
  }

  @Post("user-mappings")
  async createUserMapping(
    @Body() body: { githubUsername: string; slackUserId: string }
  ) {
    const mapping = await this.db.gitHubSlackUserMapping.upsert({
      where: { githubUsername: body.githubUsername },
      update: { slackUserId: body.slackUserId },
      create: {
        githubUsername: body.githubUsername,
        slackUserId: body.slackUserId,
      },
    });

    this.logger.log(
      `Mapped GitHub user ${body.githubUsername} to Slack user ${body.slackUserId}`
    );

    return mapping;
  }

  @Get("user-mappings")
  async listUserMappings() {
    return this.db.gitHubSlackUserMapping.findMany({
      orderBy: { githubUsername: "asc" },
    });
  }
}
