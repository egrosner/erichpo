import type { CurrentUser } from "@erichpo/shared";
import { Controller, Get, Logger, UseGuards } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { GetCurrentUser, JwtAuthGuard } from "../auth";
import type { DatabaseService } from "../database";

interface GitHubInstallation {
  id: number;
  account: {
    login: string;
    avatar_url: string;
    type: "User" | "Organization";
  };
  app_slug: string;
  app_id: number;
}

interface InstallationResponse {
  id: number;
  account: {
    login: string;
    avatarUrl: string;
    type: "User" | "Organization";
  };
  isLinked: boolean;
}

@Controller("api/github")
export class GitHubApiController {
  private readonly logger = new Logger(GitHubApiController.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly db: DatabaseService,
  ) {}

  @Get("installations")
  @UseGuards(JwtAuthGuard)
  async listInstallations(
    @GetCurrentUser() user: CurrentUser,
  ): Promise<InstallationResponse[]> {
    // Get user's GitHub access token from database
    const dbUser = await this.db.user.findUnique({
      where: { id: user.id },
      select: { githubAccessToken: true },
    });

    if (!dbUser?.githubAccessToken) {
      this.logger.warn(
        `User ${user.id} has no GitHub access token - cannot list installations`,
      );
      return [];
    }

    const appId = this.configService.get<string>("github.appId");

    // Fetch installations accessible to the user
    const response = await fetch("https://api.github.com/user/installations", {
      headers: {
        Authorization: `Bearer ${dbUser.githubAccessToken}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!response.ok) {
      this.logger.error(
        `Failed to fetch GitHub installations: ${response.status} ${response.statusText}`,
      );
      return [];
    }

    const data = (await response.json()) as {
      installations: GitHubInstallation[];
    };

    // Filter to only our app's installations
    const ourInstallations = data.installations.filter(
      (inst) => appId && inst.app_id === Number(appId),
    );

    // Check which installations are already linked to workspaces
    const linkedInstallationIds = await this.db.orgMapping.findMany({
      select: { githubInstallationId: true },
    });
    const linkedSet = new Set(
      linkedInstallationIds.map((m) => m.githubInstallationId),
    );

    this.logger.log(
      `User ${user.githubUsername} has ${ourInstallations.length} app installations`,
    );

    return ourInstallations.map((inst) => ({
      id: inst.id,
      account: {
        login: inst.account.login,
        avatarUrl: inst.account.avatar_url,
        type: inst.account.type,
      },
      isLinked: linkedSet.has(inst.id),
    }));
  }
}
