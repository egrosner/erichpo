import { Injectable, Logger } from "@nestjs/common";
import { DatabaseService } from "../database";
import { GitHubService } from "../github/github.service";
import { SlackService } from "../slack/slack.service";

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly slackService: SlackService,
    private readonly githubService: GitHubService,
    private readonly db: DatabaseService
  ) {}

  async listSlackUsers() {
    return this.slackService.listUsers();
  }

  async listGitHubCollaborators(owner: string, repo: string) {
    const installationId =
      await this.githubService.getInstallationForRepo(owner, repo);
    return this.githubService.getCollaborators(owner, repo, installationId);
  }

  async upsertUserMapping(githubUsername: string, slackUserId: string) {
    const mapping = await this.db.gitHubSlackUserMapping.upsert({
      where: { githubUsername },
      update: { slackUserId },
      create: { githubUsername, slackUserId },
    });

    this.logger.log(
      `Mapped GitHub user ${githubUsername} to Slack user ${slackUserId}`
    );

    return mapping;
  }

  async listUserMappings() {
    return this.db.gitHubSlackUserMapping.findMany({
      orderBy: { githubUsername: "asc" },
    });
  }
}
