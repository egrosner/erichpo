import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
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
        "GitHub App credentials not configured - API calls will fail",
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

  /**
   * Creates an Octokit client authenticated with a user's personal access token.
   * Used for posting comments as the user (impersonation).
   */
  private getOctokitForUser(userAccessToken: string): Octokit {
    return new Octokit({ auth: userAccessToken });
  }

  async createPrComment(
    owner: string,
    repo: string,
    prNumber: number,
    body: string,
    installationId?: number,
  ): Promise<{ id: number; html_url: string }> {
    const octokit = await this.getOctokit(installationId);

    const response = await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body,
    });

    this.logger.log(
      `Created comment on ${owner}/${repo}#${prNumber}: ${response.data.id}`,
    );

    return {
      id: response.data.id,
      html_url: response.data.html_url,
    };
  }

  /**
   * Creates a PR comment as a specific user (impersonation).
   * Uses the user's OAuth access token instead of the GitHub App.
   */
  async createPrCommentAsUser(
    owner: string,
    repo: string,
    prNumber: number,
    body: string,
    userAccessToken: string,
  ): Promise<{ id: number; html_url: string }> {
    const octokit = this.getOctokitForUser(userAccessToken);

    const response = await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body,
    });

    this.logger.log(
      `Created comment as user on ${owner}/${repo}#${prNumber}: ${response.data.id}`,
    );

    return {
      id: response.data.id,
      html_url: response.data.html_url,
    };
  }

  async createReviewCommentReply(
    owner: string,
    repo: string,
    prNumber: number,
    commentId: number,
    body: string,
    installationId?: number,
  ): Promise<{ id: number; html_url: string }> {
    const octokit = await this.getOctokit(installationId);

    const response = await octokit.rest.pulls.createReplyForReviewComment({
      owner,
      repo,
      pull_number: prNumber,
      comment_id: commentId,
      body,
    });

    this.logger.log(
      `Created review comment reply on ${owner}/${repo}#${prNumber}: ${response.data.id}`,
    );

    return {
      id: response.data.id,
      html_url: response.data.html_url,
    };
  }

  /**
   * Creates a review comment reply as a specific user (impersonation).
   * Uses the user's OAuth access token instead of the GitHub App.
   */
  async createReviewCommentReplyAsUser(
    owner: string,
    repo: string,
    prNumber: number,
    commentId: number,
    body: string,
    userAccessToken: string,
  ): Promise<{ id: number; html_url: string }> {
    const octokit = this.getOctokitForUser(userAccessToken);

    const response = await octokit.rest.pulls.createReplyForReviewComment({
      owner,
      repo,
      pull_number: prNumber,
      comment_id: commentId,
      body,
    });

    this.logger.log(
      `Created review comment reply as user on ${owner}/${repo}#${prNumber}: ${response.data.id}`,
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
    installationId?: number,
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
    owner: string,
    repo: string,
    installationId?: number,
  ): Promise<string | null> {
    const octokit = await this.getOctokit(installationId);

    // Try public profile email first
    const userResponse = await octokit.rest.users.getByUsername({ username });
    if (userResponse.data.email) {
      return userResponse.data.email;
    }

    // Fall back to email from recent commits in the repo
    const commitsResponse = await octokit.rest.repos.listCommits({
      owner,
      repo,
      author: username,
      per_page: 1,
    });

    const commit = commitsResponse.data[0];
    const email = commit?.commit?.author?.email;
    if (email && !email.endsWith("@users.noreply.github.com")) {
      return email;
    }

    return null;
  }

  async getInstallationForRepo(owner: string, repo: string): Promise<number> {
    if (!this.app) {
      throw new Error("GitHub App not initialized");
    }

    const response = await this.app.octokit.rest.apps.getRepoInstallation({
      owner,
      repo,
    });
    return response.data.id;
  }

  async getCollaborators(
    owner: string,
    repo: string,
    installationId?: number,
  ): Promise<Array<{ login: string; role: string }>> {
    const octokit = await this.getOctokit(installationId);

    const response = await octokit.rest.repos.listCollaborators({
      owner,
      repo,
      per_page: 100,
    });

    return response.data.map((c) => ({
      login: c.login!,
      role: c.role_name || "unknown",
    }));
  }

  async getTeamMembers(
    org: string,
    teamSlug: string,
    installationId?: number,
  ): Promise<string[]> {
    const octokit = await this.getOctokit(installationId);

    const response = await octokit.rest.teams.listMembersInOrg({
      org,
      team_slug: teamSlug,
    });

    return response.data.map((member) => member.login);
  }

  async getPullRequestReviews(
    owner: string,
    repo: string,
    prNumber: number,
    installationId?: number,
  ): Promise<Array<{ user: string; state: string }>> {
    const octokit = await this.getOctokit(installationId);

    const response = await octokit.rest.pulls.listReviews({
      owner,
      repo,
      pull_number: prNumber,
    });

    return response.data
      .filter((review) => review.user?.login)
      .map((review) => ({
        user: review.user?.login as string,
        state: review.state,
      }));
  }
}
