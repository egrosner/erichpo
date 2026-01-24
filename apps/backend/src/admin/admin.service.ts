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
    private readonly db: DatabaseService,
  ) {}

  async listWorkspaces() {
    return this.db.slackWorkspace.findMany({
      select: {
        id: true,
        teamId: true,
        teamName: true,
        botUserId: true,
        installedBy: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async listOrgMappings() {
    return this.db.orgMapping.findMany({
      include: {
        slackWorkspace: {
          select: { teamId: true, teamName: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async listSlackUsers(teamId?: string) {
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
    slackWorkspaceId?: number,
  ) {
    const existing = await this.db.gitHubSlackUserMapping.findFirst({
      where: {
        githubUsername,
        slackWorkspaceId: slackWorkspaceId ?? null,
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
      `Mapped GitHub user ${githubUsername} to Slack user ${slackUserId}` +
        (slackWorkspaceId ? ` (workspace ${slackWorkspaceId})` : ""),
    );

    return mapping;
  }

  async listUserMappings(slackWorkspaceId?: number) {
    return this.db.gitHubSlackUserMapping.findMany({
      where: slackWorkspaceId !== undefined ? { slackWorkspaceId } : undefined,
      orderBy: { githubUsername: "asc" },
    });
  }
}
