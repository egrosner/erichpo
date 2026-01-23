import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { WebClient } from "@slack/web-api";

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
  private client: WebClient | null = null;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const botToken = this.configService.get<string>("slack.botToken");

    if (botToken && botToken !== "xoxb-placeholder") {
      this.client = new WebClient(botToken);
      this.logger.log("Slack client initialized");
    } else {
      this.logger.warn("Slack bot token not configured - API calls will fail");
    }
  }

  private getClient(): WebClient {
    if (!this.client) {
      throw new Error("Slack client not initialized");
    }
    return this.client;
  }

  async createChannel(
    name: string
  ): Promise<{ channelId: string; channelName: string }> {
    const client = this.getClient();
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
    blocks?: SlackBlock[]
  ): Promise<{ ts: string }> {
    const client = this.getClient();

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

  async setChannelTopic(channelId: string, topic: string): Promise<void> {
    const client = this.getClient();

    await client.conversations.setTopic({
      channel: channelId,
      topic: topic.substring(0, 250), // Slack topic limit
    });
  }

  async archiveChannel(channelId: string): Promise<void> {
    const client = this.getClient();

    await client.conversations.archive({
      channel: channelId,
    });

    this.logger.log(`Archived Slack channel: ${channelId}`);
  }

  async unarchiveChannel(channelId: string): Promise<void> {
    const client = this.getClient();

    await client.conversations.unarchive({
      channel: channelId,
    });

    this.logger.log(`Unarchived Slack channel: ${channelId}`);
  }

  async getUserInfo(
    userId: string
  ): Promise<{ id: string; name: string; real_name?: string }> {
    const client = this.getClient();

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

  private sanitizeChannelName(name: string): string {
    // Slack channel names: lowercase, max 80 chars
    // Only allows: lowercase letters, numbers, underscores
    return name
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "")
      .substring(0, 80);
  }
}
