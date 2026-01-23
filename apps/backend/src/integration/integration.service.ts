import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DatabaseService } from "../database";
import { GitHubService } from "../github/github.service";
import type {
  CheckRunEvent,
  IssueCommentEvent,
  PullRequestEvent,
  PullRequestReviewCommentEvent,
  PullRequestReviewEvent,
} from "../github/schemas/webhook.schema";
import { SlackService, type SlackBlock } from "../slack/slack.service";

@Injectable()
export class IntegrationService {
  private readonly logger = new Logger(IntegrationService.name);

  constructor(
    private readonly slackService: SlackService,
    private readonly githubService: GitHubService,
    private readonly db: DatabaseService,
    private readonly configService: ConfigService
  ) {}

  // ========== GitHub -> Slack ==========

  async handlePrOpened(
    event: PullRequestEvent,
    deliveryId: string
  ): Promise<void> {
    // Check for duplicate delivery
    if (await this.isDuplicateDelivery(deliveryId, "github")) {
      this.logger.debug(`Duplicate delivery ignored: ${deliveryId}`);
      return;
    }

    const { pull_request: pr, repository, installation } = event;

    // Generate channel name
    const channelName = this.generateChannelName(
      repository.name,
      pr.number,
      pr.head.ref
    );

    // Create Slack channel
    const { channelId, channelName: actualName } =
      await this.slackService.createChannel(channelName);

    // Store mapping
    await this.db.prChannelMapping.create({
      data: {
        githubRepoOwner: repository.owner.login,
        githubRepoName: repository.name,
        githubPrNumber: pr.number,
        githubPrNodeId: pr.node_id,
        githubInstallationId: installation?.id,
        slackChannelId: channelId,
        slackChannelName: actualName,
        prTitle: pr.title,
        prAuthor: pr.user.login,
        prUrl: pr.html_url,
      },
    });

    // Set channel topic
    await this.slackService.setChannelTopic(
      channelId,
      `PR #${pr.number}: ${pr.title} | ${pr.html_url}`
    );

    // Post welcome message
    await this.slackService.postMessage(
      channelId,
      `PR #${pr.number} opened by ${pr.user.login}`,
      this.buildPrOpenedBlocks(pr, repository.full_name)
    );

    // Invite PR author to the channel
    try {
      const authorSlackId = await this.resolveGitHubUserToSlack(
        pr.user.login,
        installation?.id
      );
      if (authorSlackId) {
        await this.slackService.inviteToChannel(channelId, [authorSlackId]);
      }
    } catch (error) {
      this.logger.warn(
        `Could not invite PR author ${pr.user.login} to channel: ${(error as Error).message}`
      );
    }

    // Record delivery
    await this.recordDelivery(deliveryId, "github");

    this.logger.log(
      `Created channel ${actualName} for PR #${pr.number} in ${repository.full_name}`
    );
  }

  async handlePrClosed(
    event: PullRequestEvent,
    deliveryId: string
  ): Promise<void> {
    if (await this.isDuplicateDelivery(deliveryId, "github")) return;

    const { pull_request: pr, repository } = event;
    const isMerged = pr.merged ?? false;

    const mapping = await this.findMapping(
      repository.owner.login,
      repository.name,
      pr.number
    );
    if (!mapping) return;

    // Update status
    await this.db.prChannelMapping.update({
      where: { id: mapping.id },
      data: {
        status: isMerged ? "merged" : "closed",
        closedAt: new Date(),
      },
    });

    // Post closure message
    await this.slackService.postMessage(
      mapping.slackChannelId,
      `PR #${pr.number} ${isMerged ? "merged" : "closed"}`,
      this.buildPrClosedBlocks(pr, isMerged)
    );

    // Archive the channel
    try {
      await this.slackService.archiveChannel(mapping.slackChannelId);
      await this.db.prChannelMapping.update({
        where: { id: mapping.id },
        data: { archivedAt: new Date() },
      });
    } catch (error) {
      this.logger.warn(
        `Could not archive channel ${mapping.slackChannelId}: ${(error as Error).message}`
      );
    }

    await this.recordDelivery(deliveryId, "github");
  }

  async handlePrReopened(
    event: PullRequestEvent,
    deliveryId: string
  ): Promise<void> {
    if (await this.isDuplicateDelivery(deliveryId, "github")) return;

    const { pull_request: pr, repository } = event;

    const mapping = await this.findMapping(
      repository.owner.login,
      repository.name,
      pr.number
    );
    if (!mapping) return;

    // Update status
    await this.db.prChannelMapping.update({
      where: { id: mapping.id },
      data: {
        status: "open",
        closedAt: null,
      },
    });

    // Try to unarchive if archived
    if (mapping.archivedAt) {
      try {
        await this.slackService.unarchiveChannel(mapping.slackChannelId);
        await this.db.prChannelMapping.update({
          where: { id: mapping.id },
          data: { archivedAt: null },
        });
      } catch {
        this.logger.warn(
          `Could not unarchive channel ${mapping.slackChannelId}`
        );
      }
    }

    await this.slackService.postMessage(
      mapping.slackChannelId,
      `PR #${pr.number} reopened`,
      [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `:arrows_counterclockwise: *PR Reopened* by ${pr.user.login}`,
          },
        },
      ]
    );

    await this.recordDelivery(deliveryId, "github");
  }

  async handlePrSynchronize(
    event: PullRequestEvent,
    deliveryId: string
  ): Promise<void> {
    if (await this.isDuplicateDelivery(deliveryId, "github")) return;

    const { pull_request: pr, repository, sender } = event;

    const mapping = await this.findMapping(
      repository.owner.login,
      repository.name,
      pr.number
    );
    if (!mapping) return;

    await this.slackService.postMessage(
      mapping.slackChannelId,
      `New commits pushed to PR #${pr.number}`,
      [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `:arrow_up: *New commits pushed* by ${sender.login}\nHead: \`${pr.head.sha.substring(0, 7)}\``,
          },
        },
      ]
    );

    await this.recordDelivery(deliveryId, "github");
  }

  async handleReviewRequested(
    event: PullRequestEvent,
    deliveryId: string
  ): Promise<void> {
    if (await this.isDuplicateDelivery(deliveryId, "github")) return;

    const { pull_request: pr, repository, installation } = event;

    const mapping = await this.findMapping(
      repository.owner.login,
      repository.name,
      pr.number
    );
    if (!mapping) return;

    const slackUserIds: string[] = [];

    try {
      if (event.requested_reviewer) {
        const slackId = await this.resolveGitHubUserToSlack(
          event.requested_reviewer.login,
          installation?.id
        );
        if (slackId) slackUserIds.push(slackId);
      }

      if (event.requested_team) {
        const members = await this.githubService.getTeamMembers(
          repository.owner.login,
          event.requested_team.slug,
          installation?.id
        );
        for (const member of members) {
          try {
            const slackId = await this.resolveGitHubUserToSlack(
              member,
              installation?.id
            );
            if (slackId) slackUserIds.push(slackId);
          } catch (error) {
            this.logger.warn(
              `Could not resolve team member ${member} to Slack: ${(error as Error).message}`
            );
          }
        }
      }

      if (slackUserIds.length > 0) {
        await this.slackService.inviteToChannel(
          mapping.slackChannelId,
          slackUserIds
        );
      }
    } catch (error) {
      this.logger.warn(
        `Error inviting reviewers to channel: ${(error as Error).message}`
      );
    }

    // Post notification about review request
    const reviewerName = event.requested_reviewer
      ? event.requested_reviewer.login
      : event.requested_team
        ? `team ${event.requested_team.name}`
        : "unknown";

    await this.slackService.postMessage(
      mapping.slackChannelId,
      `Review requested from ${reviewerName}`,
      [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `:eyes: *Review requested* from *${reviewerName}*`,
          },
        },
      ]
    );

    await this.recordDelivery(deliveryId, "github");
  }

  async handlePrComment(
    event: IssueCommentEvent,
    deliveryId: string
  ): Promise<void> {
    if (await this.isDuplicateDelivery(deliveryId, "github")) return;

    const { comment, issue, repository, sender } = event;

    const mapping = await this.findMapping(
      repository.owner.login,
      repository.name,
      issue.number
    );
    if (!mapping) return;

    await this.slackService.postMessage(
      mapping.slackChannelId,
      `Comment from ${sender.login}`,
      this.buildCommentBlocks(comment.body, sender.login, comment.html_url)
    );

    await this.recordDelivery(deliveryId, "github");
  }

  async handlePrReview(
    event: PullRequestReviewEvent,
    deliveryId: string
  ): Promise<void> {
    if (await this.isDuplicateDelivery(deliveryId, "github")) return;

    const { review, pull_request: pr, repository } = event;

    const mapping = await this.findMapping(
      repository.owner.login,
      repository.name,
      pr.number
    );
    if (!mapping) return;

    const stateEmoji = {
      approved: ":white_check_mark:",
      changes_requested: ":x:",
      commented: ":speech_balloon:",
      dismissed: ":no_entry_sign:",
      pending: ":hourglass:",
    }[review.state];

    const stateText = {
      approved: "approved",
      changes_requested: "requested changes",
      commented: "commented",
      dismissed: "dismissed review",
      pending: "started review",
    }[review.state];

    await this.slackService.postMessage(
      mapping.slackChannelId,
      `${review.user.login} ${stateText}`,
      [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `${stateEmoji} *${review.user.login}* ${stateText}${review.body ? `\n\n${review.body}` : ""}`,
          },
          accessory: {
            type: "button",
            text: { type: "plain_text", text: "View Review" },
            url: review.html_url,
            action_id: "view_review",
          },
        },
      ]
    );

    await this.recordDelivery(deliveryId, "github");
  }

  async handlePrReviewComment(
    event: PullRequestReviewCommentEvent,
    deliveryId: string
  ): Promise<void> {
    if (await this.isDuplicateDelivery(deliveryId, "github")) return;

    const { comment, pull_request: pr, repository } = event;

    const mapping = await this.findMapping(
      repository.owner.login,
      repository.name,
      pr.number
    );
    if (!mapping) return;

    await this.slackService.postMessage(
      mapping.slackChannelId,
      `Review comment from ${comment.user.login}`,
      [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `:memo: *${comment.user.login}* commented on \`${comment.path}\`\n\n${comment.body}`,
          },
          accessory: {
            type: "button",
            text: { type: "plain_text", text: "View" },
            url: comment.html_url,
            action_id: "view_comment",
          },
        },
      ]
    );

    await this.recordDelivery(deliveryId, "github");
  }

  async handleCheckRunCompleted(
    event: CheckRunEvent,
    deliveryId: string
  ): Promise<void> {
    if (await this.isDuplicateDelivery(deliveryId, "github")) return;

    const { check_run, repository } = event;

    // Post to each PR that this check is associated with
    for (const pr of check_run.pull_requests) {
      const mapping = await this.findMapping(
        repository.owner.login,
        repository.name,
        pr.number
      );
      if (!mapping) continue;

      const emoji =
        check_run.conclusion === "success"
          ? ":white_check_mark:"
          : check_run.conclusion === "failure"
            ? ":x:"
            : ":warning:";

      await this.slackService.postMessage(
        mapping.slackChannelId,
        `Check ${check_run.name}: ${check_run.conclusion}`,
        [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `${emoji} *${check_run.name}*: ${check_run.conclusion}`,
            },
            accessory: {
              type: "button",
              text: { type: "plain_text", text: "Details" },
              url: check_run.html_url,
              action_id: "view_check",
            },
          },
        ]
      );
    }

    await this.recordDelivery(deliveryId, "github");
  }

  // ========== Slack -> GitHub ==========

  async handleSlackMessage(
    channelId: string,
    userId: string,
    text: string,
    ts: string,
    eventId: string
  ): Promise<void> {
    if (await this.isDuplicateDelivery(eventId, "slack")) return;

    const mapping = await this.db.prChannelMapping.findUnique({
      where: { slackChannelId: channelId },
    });

    if (!mapping) {
      // Not a PR channel, ignore
      return;
    }

    // Get Slack user info for attribution
    const userInfo = await this.slackService.getUserInfo(userId);

    // Format comment with Slack attribution
    const commentBody = `**[Slack - ${userInfo.real_name || userInfo.name}]**\n\n${text}`;

    // Post to GitHub PR
    await this.githubService.createPrComment(
      mapping.githubRepoOwner,
      mapping.githubRepoName,
      mapping.githubPrNumber,
      commentBody,
      mapping.githubInstallationId ?? undefined
    );

    await this.recordDelivery(eventId, "slack");

    this.logger.log(
      `Synced Slack message to GitHub PR #${mapping.githubPrNumber}`
    );
  }

  // ========== Helpers ==========

  private generateChannelName(
    repoName: string,
    prNumber: number,
    branchName: string
  ): string {
    const prefix = this.configService.get<string>("channel.prefix") || "pr_";
    const repo = repoName.replace(/[^a-z0-9]/gi, "_").toLowerCase();
    const branch = branchName
      .replace(/[^a-z0-9]/gi, "_")
      .toLowerCase()
      .substring(0, 30);
    return `${prefix}${repo}_${prNumber}_${branch}`;
  }

  private async resolveGitHubUserToSlack(
    username: string,
    installationId?: number
  ): Promise<string | null> {
    // Check DB cache
    const cached = await this.db.gitHubSlackUserMapping.findUnique({
      where: { githubUsername: username },
    });
    if (cached) return cached.slackUserId;

    // Get email from GitHub
    const email = await this.githubService.getUserEmail(
      username,
      installationId
    );
    if (!email) {
      this.logger.warn(`No public email found for GitHub user ${username}`);
      return null;
    }

    // Lookup Slack user by email
    const slackUserId = await this.slackService.lookupUserByEmail(email);
    if (!slackUserId) {
      this.logger.warn(
        `No Slack user found for email ${email} (GitHub: ${username})`
      );
      return null;
    }

    // Cache the mapping
    await this.db.gitHubSlackUserMapping.create({
      data: { githubUsername: username, slackUserId },
    });

    return slackUserId;
  }

  private async findMapping(owner: string, repo: string, prNumber: number) {
    return this.db.prChannelMapping.findUnique({
      where: {
        githubRepoOwner_githubRepoName_githubPrNumber: {
          githubRepoOwner: owner,
          githubRepoName: repo,
          githubPrNumber: prNumber,
        },
      },
    });
  }

  private async isDuplicateDelivery(
    id: string,
    source: string
  ): Promise<boolean> {
    const existing = await this.db.webhookDelivery.findUnique({
      where: { id },
    });
    return existing !== null;
  }

  private async recordDelivery(id: string, source: string): Promise<void> {
    await this.db.webhookDelivery.create({
      data: { id, source },
    });
  }


  // ========== Slack Block Builders ==========

  private buildPrOpenedBlocks(
    pr: PullRequestEvent["pull_request"],
    repoFullName: string
  ): SlackBlock[] {
    return [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `PR #${pr.number} Opened`,
          emoji: true,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*<${pr.html_url}|${pr.title}>*\n\n:bust_in_silhouette: Opened by *${pr.user.login}* in \`${repoFullName}\``,
        },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Base:* \`${pr.base.ref}\`` },
          { type: "mrkdwn", text: `*Head:* \`${pr.head.ref}\`` },
          {
            type: "mrkdwn",
            text: `*Changes:* +${pr.additions ?? 0} / -${pr.deletions ?? 0}`,
          },
          {
            type: "mrkdwn",
            text: `*Files:* ${pr.changed_files ?? "N/A"}`,
          },
        ],
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            pr.body?.substring(0, 500) ||
            "_No description provided_",
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "View PR" },
            url: pr.html_url,
            action_id: "view_pr",
            style: "primary",
          },
        ],
      },
    ];
  }

  private buildPrClosedBlocks(
    pr: PullRequestEvent["pull_request"],
    isMerged: boolean
  ): SlackBlock[] {
    return [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: isMerged
            ? `:tada: *PR #${pr.number} has been merged!*`
            : `:no_entry: *PR #${pr.number} has been closed without merging*`,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `_This channel will be archived._`,
        },
      },
    ];
  }

  private buildCommentBlocks(
    body: string,
    author: string,
    url: string
  ): SlackBlock[] {
    return [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `:speech_balloon: *${author}* commented:\n\n${body.substring(0, 2000)}`,
        },
        accessory: {
          type: "button",
          text: { type: "plain_text", text: "View" },
          url,
          action_id: "view_comment",
        },
      },
    ];
  }
}
