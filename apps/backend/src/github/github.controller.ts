import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  UseGuards,
} from "@nestjs/common";
import { GitHubWebhookGuard } from "../common/guards";
import { IntegrationService } from "../integration/integration.service";
import {
  checkRunEventSchema,
  issueCommentEventSchema,
  pullRequestEventSchema,
  pullRequestReviewCommentEventSchema,
  pullRequestReviewEventSchema,
} from "./schemas/webhook.schema";

@Controller("api/webhooks/github")
export class GitHubController {
  private readonly logger = new Logger(GitHubController.name);

  constructor(private readonly integrationService: IntegrationService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @UseGuards(GitHubWebhookGuard)
  async handleWebhook(
    @Headers("x-github-event") event: string,
    @Headers("x-github-delivery") deliveryId: string,
    @Body() payload: unknown,
  ) {
    this.logger.log(`Received GitHub webhook: ${event} (${deliveryId})`);

    try {
      switch (event) {
        case "pull_request":
          return await this.handlePullRequestEvent(payload, deliveryId);

        case "issue_comment":
          return await this.handleIssueCommentEvent(payload, deliveryId);

        case "pull_request_review":
          return await this.handlePullRequestReviewEvent(payload, deliveryId);

        case "pull_request_review_comment":
          return await this.handleReviewCommentEvent(payload, deliveryId);

        case "check_run":
          return await this.handleCheckRunEvent(payload, deliveryId);

        default:
          this.logger.debug(`Ignoring unhandled event: ${event}`);
          return { status: "ignored", event };
      }
    } catch (error) {
      this.logger.error(`Error processing ${event} webhook:`, error);
      // Return 200 to prevent GitHub from retrying for non-recoverable errors
      return { status: "error", message: (error as Error).message };
    }
  }

  private async handlePullRequestEvent(payload: unknown, deliveryId: string) {
    const parsed = pullRequestEventSchema.safeParse(payload);
    if (!parsed.success) {
      this.logger.warn("Invalid pull_request payload:", parsed.error);
      return { status: "invalid_payload" };
    }

    const event = parsed.data;

    switch (event.action) {
      case "opened":
        await this.integrationService.handlePrOpened(event, deliveryId);
        break;

      case "closed":
        await this.integrationService.handlePrClosed(event, deliveryId);
        break;

      case "reopened":
        await this.integrationService.handlePrReopened(event, deliveryId);
        break;

      case "synchronize":
        await this.integrationService.handlePrSynchronize(event, deliveryId);
        break;

      case "review_requested":
        await this.integrationService.handleReviewRequested(event, deliveryId);
        break;

      default:
        this.logger.debug(`Ignoring pull_request action: ${event.action}`);
    }

    return { status: "processed", action: event.action };
  }

  private async handleIssueCommentEvent(payload: unknown, deliveryId: string) {
    const parsed = issueCommentEventSchema.safeParse(payload);
    if (!parsed.success) {
      this.logger.warn("Invalid issue_comment payload:", parsed.error);
      return { status: "invalid_payload" };
    }

    const event = parsed.data;

    // Only process comments on PRs
    if (!event.issue.pull_request) {
      return { status: "ignored", reason: "not_a_pr" };
    }

    if (event.action === "created") {
      await this.integrationService.handlePrComment(event, deliveryId);
    }

    return { status: "processed", action: event.action };
  }

  private async handlePullRequestReviewEvent(
    payload: unknown,
    deliveryId: string,
  ) {
    const parsed = pullRequestReviewEventSchema.safeParse(payload);
    if (!parsed.success) {
      this.logger.warn("Invalid pull_request_review payload:", parsed.error);
      return { status: "invalid_payload" };
    }

    const event = parsed.data;

    if (event.action === "submitted") {
      await this.integrationService.handlePrReview(event, deliveryId);
    }

    return { status: "processed", action: event.action };
  }

  private async handleReviewCommentEvent(payload: unknown, deliveryId: string) {
    const parsed = pullRequestReviewCommentEventSchema.safeParse(payload);
    if (!parsed.success) {
      this.logger.warn(
        "Invalid pull_request_review_comment payload:",
        parsed.error,
      );
      return { status: "invalid_payload" };
    }

    const event = parsed.data;

    if (event.action === "created") {
      await this.integrationService.handlePrReviewComment(event, deliveryId);
    }

    return { status: "processed", action: event.action };
  }

  private async handleCheckRunEvent(payload: unknown, deliveryId: string) {
    const parsed = checkRunEventSchema.safeParse(payload);
    if (!parsed.success) {
      this.logger.warn("Invalid check_run payload:", parsed.error);
      return { status: "invalid_payload" };
    }

    const event = parsed.data;

    if (event.action === "completed") {
      await this.integrationService.handleCheckRunCompleted(event, deliveryId);
    }

    return { status: "processed", action: event.action };
  }
}
