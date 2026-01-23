import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { App, Octokit } from "octokit";

@Injectable()
export class GitHubService implements OnModuleInit {
  private readonly logger = new Logger(GitHubService.name);
  private app: App | null = null;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const appId = this.configService.get<string>("github.appId");
    const privateKey = this.configService.get<string>("github.privateKey");

    if (appId && privateKey) {
      this.app = new App({
        appId,
        privateKey,
      });
      this.logger.log("GitHub App initialized");
    } else {
      this.logger.warn(
        "GitHub App credentials not configured - API calls will fail"
      );
    }
  }

  private async getOctokit(installationId?: number): Promise<Octokit> {
    if (!this.app) {
      throw new Error("GitHub App not initialized");
    }

    if (installationId) {
      return this.app.getInstallationOctokit(installationId);
    }

    // Fall back to app-level authentication
    return new Octokit({
      auth: await this.app.octokit.auth({ type: "app" }),
    });
  }

  async createPrComment(
    owner: string,
    repo: string,
    prNumber: number,
    body: string,
    installationId?: number
  ): Promise<{ id: number; html_url: string }> {
    const octokit = await this.getOctokit(installationId);

    const response = await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body,
    });

    this.logger.log(
      `Created comment on ${owner}/${repo}#${prNumber}: ${response.data.id}`
    );

    return {
      id: response.data.id,
      html_url: response.data.html_url,
    };
  }

  async getPullRequest(
    owner: string,
    repo: string,
    prNumber: number,
    installationId?: number
  ) {
    const octokit = await this.getOctokit(installationId);

    const response = await octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: prNumber,
    });

    return response.data;
  }

  async getUserEmail(
    username: string,
    installationId?: number
  ): Promise<string | null> {
    const octokit = await this.getOctokit(installationId);

    const response = await octokit.rest.users.getByUsername({
      username,
    });

    return response.data.email || null;
  }

  async getTeamMembers(
    org: string,
    teamSlug: string,
    installationId?: number
  ): Promise<string[]> {
    const octokit = await this.getOctokit(installationId);

    const response = await octokit.rest.teams.listMembersInOrg({
      org,
      team_slug: teamSlug,
    });

    return response.data.map((member) => member.login);
  }
}
