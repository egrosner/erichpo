import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  UseGuards,
} from "@nestjs/common";
import { SlackSignatureGuard } from "../common/guards";
import { IntegrationService } from "../integration/integration.service";
import { slackEventSchema } from "./schemas/event.schema";
import { SlackService } from "./slack.service";

@Controller("api/webhooks/slack")
export class SlackController {
  private readonly logger = new Logger(SlackController.name);

  constructor(
    private readonly integrationService: IntegrationService,
    private readonly slackService: SlackService,
  ) {}

  @Post("events")
  @HttpCode(HttpStatus.OK)
  @UseGuards(SlackSignatureGuard)
  async handleEvent(@Body() payload: unknown) {
    const parsed = slackEventSchema.safeParse(payload);

    if (!parsed.success) {
      this.logger.warn("Invalid Slack event payload:", parsed.error);
      return { error: "invalid_payload" };
    }

    const event = parsed.data;

    // Handle URL verification challenge
    if (event.type === "url_verification") {
      this.logger.log("Responding to Slack URL verification challenge");
      return { challenge: event.challenge };
    }

    // Handle event callbacks
    if (event.type === "event_callback") {
      const messageEvent = event.event;

      // Ignore bot messages, app-posted messages, and message subtypes (edits, deletes, etc.)
      // app_id is present when the message was posted by an app (including via user OAuth)
      if (messageEvent.bot_id || messageEvent.app_id || messageEvent.subtype) {
        this.logger.debug(
          `Ignoring message: bot_id=${messageEvent.bot_id}, app_id=${messageEvent.app_id}, subtype=${messageEvent.subtype}`,
        );
        return { ok: true, ignored: true };
      }

      // Check if this is a message we posted (prevents echo loops)
      if (this.slackService.isOwnMessage(messageEvent.channel, messageEvent.ts)) {
        this.logger.debug(
          `Ignoring own message: channel=${messageEvent.channel}, ts=${messageEvent.ts}`,
        );
        return { ok: true, ignored: true };
      }

      // Only handle regular messages
      if (messageEvent.type === "message" && messageEvent.user) {
        this.logger.log(
          `Received message from ${messageEvent.user} in ${messageEvent.channel}`,
        );

        await this.integrationService.handleSlackMessage(
          messageEvent.channel,
          messageEvent.user,
          messageEvent.text,
          messageEvent.ts,
          event.event_id,
          event.team_id,
          messageEvent.thread_ts,
        );
      }
    }

    return { ok: true };
  }
}
