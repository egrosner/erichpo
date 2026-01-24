import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { WebClient } from "@slack/web-api";
import { DatabaseService } from "../database";

export interface SlackBlock {
  type: string;
  text?: { type: string; text: string; emoji?: boolean };
  fields?: Array<{ type: string; text: string }>;
  elements?: Array<{
    type: string;
    text?: { type: string; text: string };
    url?: string;
    action_id?: string;
    style?: string;
  }>;
  accessory?: {
    type: string;
    text?: { type: string; text: string };
    url?: string;
    action_id?: string;
  };
}

@Injectable()
export class SlackService implements OnModuleInit {
  private readonly logger = new Logger(SlackService.name);
  private fallbackClient: WebClient | null = null;
  private readonly clientCache = new Map<string, WebClient>();

  constructor(
    private readonly configService: ConfigService,
    private readonly db: DatabaseService,
  ) {}

  onModuleInit() {
    const botToken = this.configService.get<string>("slack.botToken");

    if (botToken && botToken !== "xoxb-placeholder") {
      this.fallbackClient = new WebClient(botToken);
      this.logger.log("Slack fallback client initialized from env");
    } else {
      this.logger.warn(
        "No fallback Slack bot token configured - will use per-workspace tokens only",
      );
    }
  }

  private async getClientForWorkspace(teamId?: string): Promise<WebClient> {
    if (!teamId) {
      if (this.fallbackClient) return this.fallbackClient;
      throw new Error("No teamId provided and no fallback client configured");
    }

    const cached = this.clientCache.get(teamId);
    if (cached) return cached;

    const workspace = await this.db.slackWorkspace.findUnique({
      where: { teamId },
    });

    if (workspace) {
      const client = new WebClient(workspace.botToken);
      this.clientCache.set(teamId, client);
      return client;
    }

    if (this.fallbackClient) {
      this.logger.warn(
        `No workspace found for teamId ${teamId}, using fallback client`,
      );
      return this.fallbackClient;
    }

    throw new Error(
      `No workspace found for teamId ${teamId} and no fallback configured`,
    );
  }

  /** Clear cached client for a workspace (e.g. after token refresh) */
  clearCachedClient(teamId: string): void {
    this.clientCache.delete(teamId);
  }

  async createChannel(
    name: string,
    teamId?: string,
  ): Promise<{ channelId: string; channelName: string }> {
    const client = await this.getClientForWorkspace(teamId);
    const sanitizedName = this.sanitizeChannelName(name);

    const result = await client.conversations.create({
      name: sanitizedName,
      is_private: false,
    });

    if (!result.channel?.id || !result.channel?.name) {
      throw new Error("Failed to create Slack channel");
    }

    this.logger.log(`Created Slack channel: ${result.channel.name}`);

    return {
      channelId: result.channel.id,
      channelName: result.channel.name,
    };
  }

  async postMessage(
    channelId: string,
    text: string,
    blocks?: SlackBlock[],
    teamId?: string,
  ): Promise<{ ts: string }> {
    const client = await this.getClientForWorkspace(teamId);

    const result = await client.chat.postMessage({
      channel: channelId,
      text,
      blocks,
      unfurl_links: false,
      unfurl_media: false,
    });

    if (!result.ts) {
      throw new Error("Failed to post message to Slack");
    }

    return { ts: result.ts };
  }

  async setChannelTopic(
    channelId: string,
    topic: string,
    teamId?: string,
  ): Promise<void> {
    const client = await this.getClientForWorkspace(teamId);

    await client.conversations.setTopic({
      channel: channelId,
      topic: topic.substring(0, 250),
    });
  }

  async archiveChannel(channelId: string, teamId?: string): Promise<void> {
    const client = await this.getClientForWorkspace(teamId);

    await client.conversations.archive({
      channel: channelId,
    });

    this.logger.log(`Archived Slack channel: ${channelId}`);
  }

  async unarchiveChannel(channelId: string, teamId?: string): Promise<void> {
    const client = await this.getClientForWorkspace(teamId);

    await client.conversations.unarchive({
      channel: channelId,
    });

    this.logger.log(`Unarchived Slack channel: ${channelId}`);
  }

  async getUserInfo(
    userId: string,
    teamId?: string,
  ): Promise<{ id: string; name: string; real_name?: string }> {
    const client = await this.getClientForWorkspace(teamId);

    const result = await client.users.info({
      user: userId,
    });

    if (!result.user) {
      throw new Error(`User not found: ${userId}`);
    }

    return {
      id: result.user.id!,
      name: result.user.name!,
      real_name: result.user.real_name,
    };
  }

  async lookupUserByEmail(
    email: string,
    teamId?: string,
  ): Promise<string | null> {
    const client = await this.getClientForWorkspace(teamId);

    try {
      const result = await client.users.lookupByEmail({ email });
      return result.user?.id || null;
    } catch (error: any) {
      if (error?.data?.error === "users_not_found") {
        return null;
      }
      throw error;
    }
  }

  async inviteToChannel(
    channelId: string,
    userIds: string[],
    teamId?: string,
  ): Promise<void> {
    if (userIds.length === 0) return;

    const client = await this.getClientForWorkspace(teamId);

    try {
      await client.conversations.invite({
        channel: channelId,
        users: userIds.join(","),
      });
    } catch (error: any) {
      if (error?.data?.error === "already_in_channel") {
        return;
      }
      throw error;
    }
  }

  async listUsers(
    teamId?: string,
  ): Promise<
    Array<{ id: string; name: string; real_name?: string; email?: string }>
  > {
    const client = await this.getClientForWorkspace(teamId);
    const users: Array<{
      id: string;
      name: string;
      real_name?: string;
      email?: string;
    }> = [];

    let cursor: string | undefined;
    do {
      const result = await client.users.list({ cursor, limit: 200 });
      for (const member of result.members || []) {
        if (member.deleted || member.is_bot || member.id === "USLACKBOT")
          continue;
        users.push({
          id: member.id!,
          name: member.name!,
          real_name: member.real_name,
          email: member.profile?.email,
        });
      }
      cursor = result.response_metadata?.next_cursor || undefined;
    } while (cursor);

    return users;
  }

  private sanitizeChannelName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "_")
      .replace(/_+/g, "_")
      .replace(/_$/g, "")
      .substring(0, 80);
  }
}
