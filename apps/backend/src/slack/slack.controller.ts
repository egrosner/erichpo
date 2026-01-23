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

@Controller("api/webhooks/slack")
export class SlackController {
  private readonly logger = new Logger(SlackController.name);

  constructor(private readonly integrationService: IntegrationService) {}

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

      // Ignore bot messages and message subtypes (edits, deletes, etc.)
      if (messageEvent.bot_id || messageEvent.subtype) {
        return { ok: true, ignored: true };
      }

      // Only handle regular messages
      if (messageEvent.type === "message" && messageEvent.user) {
        this.logger.log(
          `Received message from ${messageEvent.user} in ${messageEvent.channel}`
        );

        await this.integrationService.handleSlackMessage(
          messageEvent.channel,
          messageEvent.user,
          messageEvent.text,
          messageEvent.ts,
          event.event_id
        );
      }
    }

    return { ok: true };
  }
}
