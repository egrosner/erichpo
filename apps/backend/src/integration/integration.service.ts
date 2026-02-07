import { Injectable, Logger } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { DatabaseService } from "../database";
import type { GitHubService } from "../github/github.service";
import type {
  CheckRunEvent,
  IssueCommentEvent,
  PullRequestEvent,
  PullRequestReviewCommentEvent,
  PullRequestReviewEvent,
} from "../github/schemas/webhook.schema";
import type { SlackBlock, SlackService } from "../slack/slack.service";

@Injectable()
export class IntegrationService {
  private readonly logger = new Logger(IntegrationService.name);

  constructor(
    private readonly slackService: SlackService,
    private readonly githubService: GitHubService,
    private readonly db: DatabaseService,
    private readonly configService: ConfigService,
  ) {}

  // ========== Workspace Resolution ==========

  private async resolveWorkspaceForInstallation(
    installationId?: number,
  ): Promise<{ teamId?: string; workspaceId?: number }> {
    if (!installationId) return {};

    const orgMapping = await this.db.orgMapping.findUnique({
      where: { githubInstallationId: installationId },
      include: { slackWorkspace: true },
    });

    if (!orgMapping) return {};

    return {
      teamId: orgMapping.slackWorkspace.teamId,
      workspaceId: orgMapping.slackWorkspaceId,
    };
  }

  /**
   * Gets user preferences for Slack notifications.
   * Looks up the user by their GitHub username and returns their workspace-specific preferences.
   * Returns defaults (all true) if user or membership not found.
   */
  private async getUserPreferences(
    githubUsername: string,
    workspaceId?: number,
  ): Promise<{ slackMentions: boolean; slackInvites: boolean }> {
    const defaults = { slackMentions: true, slackInvites: true };

    if (!workspaceId) return defaults;

    // Find the user by GitHub username
    const user = await this.db.user.findFirst({
      where: { githubUsername },
    });

    if (!user) return defaults;

    // Find their workspace membership
    const membership = await this.db.workspaceMembership.findUnique({
      where: {
        userId_slackWorkspaceId: {
          userId: user.id,
          slackWorkspaceId: workspaceId,
        },
      },
      select: {
        slackMentions: true,
        slackInvites: true,
      },
    });

    if (!membership) return defaults;

    return {
      slackMentions: membership.slackMentions,
      slackInvites: membership.slackInvites,
    };
  }

  /**
   * Looks up a user's GitHub access token from their Slack user ID.
   * Used for posting comments as the user (impersonation).
   * Returns null if user mapping not found or user has no stored token.
   */
  private async getGitHubTokenForSlackUser(
    slackUserId: string,
    workspaceId?: number,
  ): Promise<{ token: string; username: string } | null> {
    // First find the GitHub username from the Slack user mapping
    const userMapping = await this.db.gitHubSlackUserMapping.findFirst({
      where: {
        slackUserId,
        slackWorkspaceId: workspaceId ?? null,
      },
    });

    if (!userMapping) {
      return null;
    }

    // Find the User record with the stored GitHub access token
    const user = await this.db.user.findFirst({
      where: { githubUsername: userMapping.githubUsername },
      select: { githubAccessToken: true, githubUsername: true },
    });

    if (!user?.githubAccessToken) {
      return null;
    }

    return {
      token: user.githubAccessToken,
      username: user.githubUsername,
    };
  }

  /**
   * Looks up a user's Slack access token from their GitHub username.
   * Used for posting Slack messages as the user (impersonation).
   * Returns null if user not found or user has no stored Slack token.
   */
  private async getSlackTokenForGitHubUser(
    githubUsername: string,
    workspaceId?: number,
  ): Promise<{ token: string; slackUserId: string } | null> {
    if (!workspaceId) return null;

    // Find the User record by GitHub username
    const user = await this.db.user.findFirst({
      where: { githubUsername },
      select: { id: true },
    });

    if (!user) {
      return null;
    }

    // Find their workspace membership with Slack token
    const membership = await this.db.workspaceMembership.findUnique({
      where: {
        userId_slackWorkspaceId: {
          userId: user.id,
          slackWorkspaceId: workspaceId,
        },
      },
      select: {
        slackAccessToken: true,
        slackUserId: true,
      },
    });

    if (!membership?.slackAccessToken || !membership?.slackUserId) {
      return null;
    }

    return {
      token: membership.slackAccessToken,
      slackUserId: membership.slackUserId,
    };
  }

  // ========== GitHub -> Slack ==========

  async handlePrOpened(
    event: PullRequestEvent,
    deliveryId: string,
  ): Promise<void> {
    if (await this.isDuplicateDelivery(deliveryId, "github")) {
      this.logger.debug(`Duplicate delivery ignored: ${deliveryId}`);
      return;
    }

    const { pull_request: pr, repository, installation } = event;

    const { teamId, workspaceId } = await this.resolveWorkspaceForInstallation(
      installation?.id,
    );

    const channelName = this.generateChannelName(
      repository.name,
      pr.number,
      pr.head.ref,
    );

    const { channelId, channelName: actualName } =
      await this.slackService.createChannel(channelName, teamId);

    await this.db.prChannelMapping.create({
      data: {
        githubRepoOwner: repository.owner.login,
        githubRepoName: repository.name,
        githubPrNumber: pr.number,
        githubPrNodeId: pr.node_id,
        githubInstallationId: installation?.id,
        slackChannelId: channelId,
        slackChannelName: actualName,
        slackWorkspaceId: workspaceId,
        prTitle: pr.title,
        prAuthor: pr.user.login,
        prUrl: pr.html_url,
      },
    });

    await this.slackService.setChannelTopic(
      channelId,
      `PR #${pr.number}: ${pr.title} | ${pr.html_url}`,
      teamId,
    );

    await this.slackService.postMessage(
      channelId,
      `PR #${pr.number} opened by ${pr.user.login}`,
      this.buildPrOpenedBlocks(pr, repository.full_name),
      teamId,
    );

    try {
      // Check if the author has opted out of channel invites
      const authorPrefs = await this.getUserPreferences(
        pr.user.login,
        workspaceId,
      );

      if (authorPrefs.slackInvites) {
        const authorSlackId = await this.resolveGitHubUserToSlack(
          pr.user.login,
          repository.owner.login,
          repository.name,
          installation?.id,
          teamId,
          workspaceId,
        );
        if (authorSlackId) {
          await this.slackService.inviteToChannel(
            channelId,
            [authorSlackId],
            teamId,
          );
        }
      } else {
        this.logger.debug(
          `Skipping channel invite for PR author ${pr.user.login} (opted out)`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `Could not invite PR author ${pr.user.login} to channel: ${(error as Error).message}`,
      );
    }

    await this.recordDelivery(deliveryId, "github");

    this.logger.log(
      `Created channel ${actualName} for PR #${pr.number} in ${repository.full_name}`,
    );
  }

  async handlePrClosed(
    event: PullRequestEvent,
    deliveryId: string,
  ): Promise<void> {
    if (await this.isDuplicateDelivery(deliveryId, "github")) return;

    const { pull_request: pr, repository, installation } = event;
    const isMerged = pr.merged ?? false;

    const { teamId } = await this.resolveWorkspaceForInstallation(
      installation?.id,
    );

    const mapping = await this.findMapping(
      repository.owner.login,
      repository.name,
      pr.number,
    );
    if (!mapping) return;

    await this.db.prChannelMapping.update({
      where: { id: mapping.id },
      data: {
        status: isMerged ? "merged" : "closed",
        closedAt: new Date(),
      },
    });

    await this.slackService.postMessage(
      mapping.slackChannelId,
      `PR #${pr.number} ${isMerged ? "merged" : "closed"}`,
      this.buildPrClosedBlocks(pr, isMerged),
      teamId,
    );

    try {
      await this.slackService.archiveChannel(mapping.slackChannelId, teamId);
      await this.db.prChannelMapping.update({
        where: { id: mapping.id },
        data: { archivedAt: new Date() },
      });
    } catch (error) {
      this.logger.warn(
        `Could not archive channel ${mapping.slackChannelId}: ${(error as Error).message}`,
      );
    }

    await this.recordDelivery(deliveryId, "github");
  }

  async handlePrReopened(
    event: PullRequestEvent,
    deliveryId: string,
  ): Promise<void> {
    if (await this.isDuplicateDelivery(deliveryId, "github")) return;

    const { pull_request: pr, repository, installation } = event;

    const { teamId, workspaceId } = await this.resolveWorkspaceForInstallation(
      installation?.id,
    );

    const mapping = await this.findMapping(
      repository.owner.login,
      repository.name,
      pr.number,
    );

    if (!mapping) {
      // Channel was never created — create it now
      const channelName = this.generateChannelName(
        repository.name,
        pr.number,
        pr.head.ref,
      );

      const { channelId, channelName: actualName } =
        await this.slackService.createChannel(channelName, teamId);

      await this.db.prChannelMapping.create({
        data: {
          githubRepoOwner: repository.owner.login,
          githubRepoName: repository.name,
          githubPrNumber: pr.number,
          githubPrNodeId: pr.node_id,
          githubInstallationId: installation?.id,
          slackChannelId: channelId,
          slackChannelName: actualName,
          slackWorkspaceId: workspaceId,
          prTitle: pr.title,
          prAuthor: pr.user.login,
          prUrl: pr.html_url,
        },
      });

      await this.slackService.setChannelTopic(
        channelId,
        `PR #${pr.number}: ${pr.title} | ${pr.html_url}`,
        teamId,
      );

      await this.slackService.postMessage(
        channelId,
        `PR #${pr.number} reopened by ${pr.user.login}`,
        this.buildPrOpenedBlocks(pr, repository.full_name),
        teamId,
      );

      try {
        // Check if the author has opted out of channel invites
        const authorPrefs = await this.getUserPreferences(
          pr.user.login,
          workspaceId,
        );

        if (authorPrefs.slackInvites) {
          const authorSlackId = await this.resolveGitHubUserToSlack(
            pr.user.login,
            repository.owner.login,
            repository.name,
            installation?.id,
            teamId,
            workspaceId,
          );
          if (authorSlackId) {
            await this.slackService.inviteToChannel(
              channelId,
              [authorSlackId],
              teamId,
            );
          }
        } else {
          this.logger.debug(
            `Skipping channel invite for PR author ${pr.user.login} (opted out)`,
          );
        }
      } catch (error) {
        this.logger.warn(
          `Could not invite PR author ${pr.user.login} to channel: ${(error as Error).message}`,
        );
      }

      await this.recordDelivery(deliveryId, "github");
      this.logger.log(
        `Created channel ${actualName} for reopened PR #${pr.number} in ${repository.full_name}`,
      );
      return;
    }

    await this.db.prChannelMapping.update({
      where: { id: mapping.id },
      data: {
        status: "open",
        closedAt: null,
      },
    });

    if (mapping.archivedAt) {
      try {
        await this.slackService.unarchiveChannel(
          mapping.slackChannelId,
          teamId,
        );
        await this.db.prChannelMapping.update({
          where: { id: mapping.id },
          data: { archivedAt: null },
        });
      } catch {
        this.logger.warn(
          `Could not unarchive channel ${mapping.slackChannelId}`,
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
      ],
      teamId,
    );

    await this.recordDelivery(deliveryId, "github");
  }

  async handlePrSynchronize(
    event: PullRequestEvent,
    deliveryId: string,
  ): Promise<void> {
    if (await this.isDuplicateDelivery(deliveryId, "github")) return;

    const { pull_request: pr, repository, sender, installation } = event;

    const { teamId } = await this.resolveWorkspaceForInstallation(
      installation?.id,
    );

    const mapping = await this.findMapping(
      repository.owner.login,
      repository.name,
      pr.number,
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
      ],
      teamId,
    );

    await this.recordDelivery(deliveryId, "github");
  }

  async handleReviewRequested(
    event: PullRequestEvent,
    deliveryId: string,
  ): Promise<void> {
    if (await this.isDuplicateDelivery(deliveryId, "github")) return;

    const { pull_request: pr, repository, installation } = event;

    const { teamId, workspaceId } = await this.resolveWorkspaceForInstallation(
      installation?.id,
    );

    const mapping = await this.findMapping(
      repository.owner.login,
      repository.name,
      pr.number,
    );
    if (!mapping) return;

    // Check if this is a re-review request by looking for previous reviews from this user
    let isReReview = false;
    if (event.requested_reviewer) {
      try {
        const existingReviews = await this.githubService.getPullRequestReviews(
          repository.owner.login,
          repository.name,
          pr.number,
          installation?.id,
        );
        isReReview = existingReviews.some(
          (review) =>
            review.user === event.requested_reviewer?.login &&
            review.state !== "PENDING",
        );
      } catch (error) {
        this.logger.warn(
          `Could not check for existing reviews: ${(error as Error).message}`,
        );
      }
    }

    const slackUserIdsToInvite: string[] = [];
    let explicitReviewerSlackId: string | null = null;
    let explicitReviewerPrefs: {
      slackMentions: boolean;
      slackInvites: boolean;
    } | null = null;

    try {
      if (event.requested_reviewer) {
        // Check reviewer's preferences
        explicitReviewerPrefs = await this.getUserPreferences(
          event.requested_reviewer.login,
          workspaceId,
        );

        const slackId = await this.resolveGitHubUserToSlack(
          event.requested_reviewer.login,
          repository.owner.login,
          repository.name,
          installation?.id,
          teamId,
          workspaceId,
        );
        if (slackId) {
          explicitReviewerSlackId = slackId;
          // Only add to invite list if user hasn't opted out
          if (explicitReviewerPrefs.slackInvites) {
            slackUserIdsToInvite.push(slackId);
          } else {
            this.logger.debug(
              `Skipping channel invite for reviewer ${event.requested_reviewer.login} (opted out)`,
            );
          }
        }
      }

      if (event.requested_team) {
        const members = await this.githubService.getTeamMembers(
          repository.owner.login,
          event.requested_team.slug,
          installation?.id,
        );
        for (const member of members) {
          try {
            // Check each team member's preferences
            const memberPrefs = await this.getUserPreferences(
              member,
              workspaceId,
            );

            if (!memberPrefs.slackInvites) {
              this.logger.debug(
                `Skipping channel invite for team member ${member} (opted out)`,
              );
              continue;
            }

            const slackId = await this.resolveGitHubUserToSlack(
              member,
              repository.owner.login,
              repository.name,
              installation?.id,
              teamId,
              workspaceId,
            );
            if (slackId) slackUserIdsToInvite.push(slackId);
          } catch (error) {
            this.logger.warn(
              `Could not resolve team member ${member} to Slack: ${(error as Error).message}`,
            );
          }
        }
      }

      if (slackUserIdsToInvite.length > 0) {
        await this.slackService.inviteToChannel(
          mapping.slackChannelId,
          slackUserIdsToInvite,
          teamId,
        );
      }
    } catch (error) {
      this.logger.warn(
        `Error inviting reviewers to channel: ${(error as Error).message}`,
      );
    }

    // Build reviewer display: only @mention if user hasn't opted out of mentions
    let reviewerDisplay: string;
    if (explicitReviewerSlackId && explicitReviewerPrefs?.slackMentions) {
      reviewerDisplay = `<@${explicitReviewerSlackId}>`;
    } else if (event.requested_reviewer) {
      reviewerDisplay = event.requested_reviewer.login;
    } else if (event.requested_team) {
      reviewerDisplay = `team ${event.requested_team.name}`;
    } else {
      reviewerDisplay = "unknown";
    }

    // Use different message for re-review requests
    const emoji = isReReview ? ":arrows_counterclockwise:" : ":eyes:";
    const action = isReReview ? "Re-review requested" : "Review requested";
    const fallbackText = `${action} from ${event.requested_reviewer?.login ?? event.requested_team?.name ?? "reviewer"}`;

    await this.slackService.postMessage(
      mapping.slackChannelId,
      fallbackText,
      [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `${emoji} *${action}* from ${reviewerDisplay}`,
          },
        },
      ],
      teamId,
    );

    await this.recordDelivery(deliveryId, "github");
  }

  async handlePrComment(
    event: IssueCommentEvent,
    deliveryId: string,
  ): Promise<void> {
    if (await this.isDuplicateDelivery(deliveryId, "github")) return;

    const { comment, issue, repository, sender, installation } = event;

    // Ignore comments from our own bot to prevent echo loops
    if (sender.login.endsWith("[bot]")) return;

    // Ignore comments that were synced from Slack (prevents echo loops)
    if (comment.body.includes("<!-- synced-from-slack -->")) {
      this.logger.debug(`Ignoring comment synced from Slack: ${comment.id}`);
      return;
    }

    const { teamId, workspaceId } = await this.resolveWorkspaceForInstallation(
      installation?.id,
    );

    const mapping = await this.findMapping(
      repository.owner.login,
      repository.name,
      issue.number,
    );
    if (!mapping) return;

    // Process @mentions in comment body
    const { processedText } = await this.processGitHubMentions(
      comment.body,
      mapping.slackChannelId,
      repository.owner.login,
      repository.name,
      installation?.id,
      teamId,
      workspaceId,
    );

    // Try to post as the user if they have connected their Slack account
    const slackAuth = await this.getSlackTokenForGitHubUser(
      sender.login,
      workspaceId,
    );

    if (slackAuth) {
      // Post as the user (impersonation)
      await this.slackService.postMessageAsUser(
        mapping.slackChannelId,
        processedText,
        [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `${processedText}`,
            },
            accessory: {
              type: "button",
              text: { type: "plain_text", text: "View" },
              url: comment.html_url,
              action_id: "view_comment",
            },
          },
        ],
        slackAuth.token,
      );
      this.logger.log(
        `Posted comment from ${sender.login} as Slack user ${slackAuth.slackUserId}`,
      );
    } else {
      // Fallback: post as bot with attribution
      await this.slackService.postMessage(
        mapping.slackChannelId,
        `Comment from ${sender.login}`,
        this.buildCommentBlocks(processedText, sender.login, comment.html_url),
        teamId,
      );
    }

    await this.recordDelivery(deliveryId, "github");
  }

  async handlePrReview(
    event: PullRequestReviewEvent,
    deliveryId: string,
  ): Promise<void> {
    if (await this.isDuplicateDelivery(deliveryId, "github")) return;

    const { review, pull_request: pr, repository, installation } = event;

    // Skip "commented" reviews with no body — these are just container events
    // for individual review comments, which are handled by handlePrReviewComment
    if (review.state === "commented" && !review.body) return;

    const { teamId, workspaceId } = await this.resolveWorkspaceForInstallation(
      installation?.id,
    );

    const mapping = await this.findMapping(
      repository.owner.login,
      repository.name,
      pr.number,
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

    // Process @mentions in review body if present
    let processedBody = review.body || "";
    if (review.body) {
      const { processedText } = await this.processGitHubMentions(
        review.body,
        mapping.slackChannelId,
        repository.owner.login,
        repository.name,
        installation?.id,
        teamId,
        workspaceId,
      );
      processedBody = processedText;
    }

    // Try to post as the user if they have connected their Slack account
    const slackAuth = await this.getSlackTokenForGitHubUser(
      review.user.login,
      workspaceId,
    );

    const blocks = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: slackAuth
            ? `${stateEmoji} ${stateText}${processedBody ? `\n\n${processedBody}` : ""}`
            : `${stateEmoji} *${review.user.login}* ${stateText}${processedBody ? `\n\n${processedBody}` : ""}`,
        },
        accessory: {
          type: "button",
          text: { type: "plain_text", text: "View Review" },
          url: review.html_url,
          action_id: "view_review",
        },
      },
    ];

    if (slackAuth) {
      // Post as the user (impersonation)
      await this.slackService.postMessageAsUser(
        mapping.slackChannelId,
        `${stateText}`,
        blocks,
        slackAuth.token,
      );
      this.logger.log(
        `Posted review from ${review.user.login} as Slack user ${slackAuth.slackUserId}`,
      );
    } else {
      // Fallback: post as bot with attribution
      await this.slackService.postMessage(
        mapping.slackChannelId,
        `${review.user.login} ${stateText}`,
        blocks,
        teamId,
      );
    }

    await this.recordDelivery(deliveryId, "github");
  }

  async handlePrReviewComment(
    event: PullRequestReviewCommentEvent,
    deliveryId: string,
  ): Promise<void> {
    if (await this.isDuplicateDelivery(deliveryId, "github")) return;

    const { comment, pull_request: pr, repository, installation } = event;

    // Ignore comments from our own bot to prevent echo loops
    if (event.sender.login.endsWith("[bot]")) return;

    const { teamId, workspaceId } = await this.resolveWorkspaceForInstallation(
      installation?.id,
    );

    const mapping = await this.findMapping(
      repository.owner.login,
      repository.name,
      pr.number,
    );
    if (!mapping) return;

    // Process @mentions in comment body
    const { processedText } = await this.processGitHubMentions(
      comment.body,
      mapping.slackChannelId,
      repository.owner.login,
      repository.name,
      installation?.id,
      teamId,
      workspaceId,
    );

    // Try to post as the user if they have connected their Slack account
    const slackAuth = await this.getSlackTokenForGitHubUser(
      comment.user.login,
      workspaceId,
    );

    // Build blocks differently depending on impersonation
    const blocks: SlackBlock[] = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: slackAuth
            ? `:memo: Commented on \`${comment.path}\`\n\n${processedText}`
            : `:memo: *${comment.user.login}* commented on \`${comment.path}\`\n\n${processedText}`,
        },
        accessory: {
          type: "button",
          text: { type: "plain_text", text: "View" },
          url: comment.html_url,
          action_id: "view_comment",
        },
      },
    ];

    // If this is a reply to an existing review comment, post in the thread
    if (comment.in_reply_to_id) {
      const parentMapping = await this.db.slackMessageMapping.findFirst({
        where: {
          githubCommentId: comment.in_reply_to_id,
          slackChannelId: mapping.slackChannelId,
        },
      });

      if (parentMapping) {
        if (slackAuth) {
          await this.slackService.postMessageAsUser(
            mapping.slackChannelId,
            `Reply on ${comment.path}`,
            blocks,
            slackAuth.token,
            parentMapping.slackMessageTs,
          );
          this.logger.log(
            `Posted review comment reply from ${comment.user.login} as Slack user ${slackAuth.slackUserId}`,
          );
        } else {
          await this.slackService.postMessage(
            mapping.slackChannelId,
            `Reply from ${comment.user.login}`,
            blocks,
            teamId,
            parentMapping.slackMessageTs,
          );
        }
        await this.recordDelivery(deliveryId, "github");
        return;
      }
    }

    // Top-level review comment — post as new message and store mapping
    let ts: string;
    if (slackAuth) {
      const result = await this.slackService.postMessageAsUser(
        mapping.slackChannelId,
        `Review comment on ${comment.path}`,
        blocks,
        slackAuth.token,
      );
      ts = result.ts;
      this.logger.log(
        `Posted review comment from ${comment.user.login} as Slack user ${slackAuth.slackUserId}`,
      );
    } else {
      const result = await this.slackService.postMessage(
        mapping.slackChannelId,
        `Review comment from ${comment.user.login}`,
        blocks,
        teamId,
      );
      ts = result.ts;
    }

    await this.db.slackMessageMapping.create({
      data: {
        slackChannelId: mapping.slackChannelId,
        slackMessageTs: ts,
        githubCommentId: comment.id,
        githubRepoOwner: repository.owner.login,
        githubRepoName: repository.name,
        githubPrNumber: pr.number,
      },
    });

    await this.recordDelivery(deliveryId, "github");
  }

  async handleCheckRunCompleted(
    event: CheckRunEvent,
    deliveryId: string,
  ): Promise<void> {
    if (await this.isDuplicateDelivery(deliveryId, "github")) return;

    const { check_run, repository, installation } = event;

    const { teamId } = await this.resolveWorkspaceForInstallation(
      installation?.id,
    );

    for (const pr of check_run.pull_requests) {
      const mapping = await this.findMapping(
        repository.owner.login,
        repository.name,
        pr.number,
      );
      if (!mapping) continue;

      // Store/update this check run result
      await this.db.checkRunResult.upsert({
        where: {
          checkRunId_prChannelMappingId: {
            checkRunId: check_run.id,
            prChannelMappingId: mapping.id,
          },
        },
        update: {
          status: check_run.status,
          conclusion: check_run.conclusion,
          detailsUrl: check_run.html_url,
          updatedAt: new Date(),
        },
        create: {
          checkRunId: check_run.id,
          headSha: check_run.head_sha,
          name: check_run.name,
          status: check_run.status,
          conclusion: check_run.conclusion,
          detailsUrl: check_run.html_url,
          prChannelMappingId: mapping.id,
        },
      });

      // Get all check runs for this commit
      const allCheckRuns = await this.db.checkRunResult.findMany({
        where: {
          headSha: check_run.head_sha,
          prChannelMappingId: mapping.id,
        },
        orderBy: { name: "asc" },
      });

      // Build the aggregated CI status message
      const { text, blocks } = this.buildCiStatusBlocks(
        allCheckRuns,
        check_run.head_sha,
      );

      // Check if we already have a CI status message for this commit
      const existingMessage = await this.db.ciStatusMessage.findUnique({
        where: {
          headSha_prChannelMappingId: {
            headSha: check_run.head_sha,
            prChannelMappingId: mapping.id,
          },
        },
      });

      if (existingMessage) {
        // Update the existing message
        await this.slackService.updateMessage(
          mapping.slackChannelId,
          existingMessage.slackMessageTs,
          text,
          blocks,
          teamId,
        );
      } else {
        // Create a new aggregated message
        const { ts } = await this.slackService.postMessage(
          mapping.slackChannelId,
          text,
          blocks,
          teamId,
        );

        // Store the message reference
        await this.db.ciStatusMessage.create({
          data: {
            headSha: check_run.head_sha,
            slackChannelId: mapping.slackChannelId,
            slackMessageTs: ts,
            prChannelMappingId: mapping.id,
          },
        });
      }
    }

    await this.recordDelivery(deliveryId, "github");
  }

  private buildCiStatusBlocks(
    checkRuns: Array<{
      name: string;
      status: string;
      conclusion: string | null;
      detailsUrl: string;
    }>,
    headSha: string,
  ): { text: string; blocks: SlackBlock[] } {
    const passed = checkRuns.filter((c) => c.conclusion === "success").length;
    const failed = checkRuns.filter(
      (c) => c.conclusion === "failure" || c.conclusion === "timed_out",
    ).length;
    const inProgress = checkRuns.filter((c) => c.status !== "completed").length;
    const total = checkRuns.length;

    // Determine overall status
    let overallEmoji: string;
    let overallStatus: string;

    if (inProgress > 0) {
      overallEmoji = ":hourglass_flowing_sand:";
      overallStatus = "CI in progress";
    } else if (failed > 0) {
      overallEmoji = ":x:";
      overallStatus = "CI failed";
    } else if (passed === total) {
      overallEmoji = ":white_check_mark:";
      overallStatus = "CI passed";
    } else {
      overallEmoji = ":warning:";
      overallStatus = "CI completed with warnings";
    }

    const text = `${overallStatus} (${passed}/${total} passed) for ${headSha.substring(0, 7)}`;

    // Build check run list
    const checkLines = checkRuns
      .map((c) => {
        const emoji = this.getCheckRunEmoji(c.status, c.conclusion);
        const status =
          c.status === "completed" ? c.conclusion || "completed" : c.status;
        return `${emoji} <${c.detailsUrl}|${c.name}>: ${status}`;
      })
      .join("\n");

    const blocks: SlackBlock[] = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `${overallEmoji} *${overallStatus}* for \`${headSha.substring(0, 7)}\`\n${passed}/${total} checks passed${failed > 0 ? `, ${failed} failed` : ""}${inProgress > 0 ? `, ${inProgress} in progress` : ""}`,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: checkLines,
        },
      },
    ];

    return { text, blocks };
  }

  private getCheckRunEmoji(status: string, conclusion: string | null): string {
    if (status !== "completed") {
      return status === "in_progress"
        ? ":arrows_counterclockwise:"
        : ":hourglass:";
    }

    switch (conclusion) {
      case "success":
        return ":white_check_mark:";
      case "failure":
      case "timed_out":
        return ":x:";
      case "cancelled":
        return ":no_entry_sign:";
      case "skipped":
        return ":fast_forward:";
      case "neutral":
        return ":white_circle:";
      default:
        return ":warning:";
    }
  }

  // ========== Slack -> GitHub ==========

  async handleSlackMessage(
    channelId: string,
    userId: string,
    text: string,
    ts: string,
    eventId: string,
    teamId?: string,
    threadTs?: string,
  ): Promise<void> {
    if (await this.isDuplicateDelivery(eventId, "slack")) return;

    const mapping = await this.db.prChannelMapping.findUnique({
      where: { slackChannelId: channelId },
    });

    if (!mapping) {
      return;
    }

    const userInfo = await this.slackService.getUserInfo(userId, teamId);

    // Try to get the user's GitHub token for impersonation
    const githubAuth = await this.getGitHubTokenForSlackUser(
      userId,
      mapping.slackWorkspaceId ?? undefined,
    );

    // If user has a token, post as them directly; otherwise use bot with attribution
    const useImpersonation = !!githubAuth?.token;
    // Add marker to identify comments synced from Slack (prevents echo loops)
    const slackSyncMarker = "<!-- synced-from-slack -->";
    const commentBody = useImpersonation
      ? `${text}\n\n${slackSyncMarker}`
      : `**[Slack - ${userInfo.real_name || userInfo.name}]**\n\n${text}\n\n${slackSyncMarker}`;

    // If this is a thread reply, check if the parent maps to a review comment
    if (threadTs) {
      const messageMapping = await this.db.slackMessageMapping.findUnique({
        where: {
          slackChannelId_slackMessageTs: {
            slackChannelId: channelId,
            slackMessageTs: threadTs,
          },
        },
      });

      if (messageMapping) {
        if (useImpersonation) {
          await this.githubService.createReviewCommentReplyAsUser(
            messageMapping.githubRepoOwner,
            messageMapping.githubRepoName,
            messageMapping.githubPrNumber,
            messageMapping.githubCommentId,
            commentBody,
            githubAuth.token,
          );
          this.logger.log(
            `Synced Slack thread reply as ${githubAuth.username} to GitHub review comment #${messageMapping.githubCommentId}`,
          );
        } else {
          await this.githubService.createReviewCommentReply(
            messageMapping.githubRepoOwner,
            messageMapping.githubRepoName,
            messageMapping.githubPrNumber,
            messageMapping.githubCommentId,
            commentBody,
            mapping.githubInstallationId ?? undefined,
          );
          this.logger.log(
            `Synced Slack thread reply to GitHub review comment #${messageMapping.githubCommentId}`,
          );
        }

        await this.recordDelivery(eventId, "slack");
        return;
      }
    }

    if (useImpersonation) {
      await this.githubService.createPrCommentAsUser(
        mapping.githubRepoOwner,
        mapping.githubRepoName,
        mapping.githubPrNumber,
        commentBody,
        githubAuth.token,
      );
      this.logger.log(
        `Synced Slack message as ${githubAuth.username} to GitHub PR #${mapping.githubPrNumber}`,
      );
    } else {
      await this.githubService.createPrComment(
        mapping.githubRepoOwner,
        mapping.githubRepoName,
        mapping.githubPrNumber,
        commentBody,
        mapping.githubInstallationId ?? undefined,
      );
      this.logger.log(
        `Synced Slack message to GitHub PR #${mapping.githubPrNumber}`,
      );
    }

    await this.recordDelivery(eventId, "slack");
  }

  // ========== Helpers ==========

  private generateChannelName(
    repoName: string,
    prNumber: number,
    branchName: string,
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
    owner: string,
    repo: string,
    installationId?: number,
    teamId?: string,
    workspaceId?: number,
  ): Promise<string | null> {
    // Check DB cache (scoped to workspace if available)
    const cached = await this.db.gitHubSlackUserMapping.findFirst({
      where: {
        githubUsername: username,
        slackWorkspaceId: workspaceId ?? null,
      },
    });
    if (cached) return cached.slackUserId;

    // Get email from GitHub (profile or commit history)
    const email = await this.githubService.getUserEmail(
      username,
      owner,
      repo,
      installationId,
    );
    if (!email) {
      this.logger.warn(`No email found for GitHub user ${username}`);
      return null;
    }

    // Lookup Slack user by email
    const slackUserId = await this.slackService.lookupUserByEmail(
      email,
      teamId,
    );
    if (!slackUserId) {
      this.logger.warn(
        `No Slack user found for email ${email} (GitHub: ${username})`,
      );
      return null;
    }

    // Cache the mapping
    await this.db.gitHubSlackUserMapping.create({
      data: {
        githubUsername: username,
        slackUserId,
        slackWorkspaceId: workspaceId,
      },
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
    source: string,
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
    repoFullName: string,
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
          text: pr.body?.substring(0, 500) || "_No description provided_",
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
    isMerged: boolean,
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
          text: "_This channel will be archived._",
        },
      },
    ];
  }

  private buildCommentBlocks(
    body: string,
    author: string,
    url: string,
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

  // ========== Mention Processing ==========

  /**
   * Extracts GitHub @mentions from text and returns the usernames.
   * Matches @username patterns but excludes email-like patterns.
   */
  private extractGitHubMentions(text: string): string[] {
    // Match @username but not email addresses (no preceding alphanumeric or dot)
    const mentionRegex =
      /(?<![a-zA-Z0-9.])@([a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)/g;
    const mentions: string[] = [];

    for (const match of text.matchAll(mentionRegex)) {
      const username = match[1];
      if (!mentions.includes(username)) {
        mentions.push(username);
      }
    }

    return mentions;
  }

  /**
   * Processes GitHub @mentions in text, converting them to Slack <@USERID> format.
   * Also invites mentioned users to the channel (respecting user preferences).
   *
   * Users who have opted out of mentions will have their @username kept as plain text.
   * Users who have opted out of invites will not be added to the channel.
   *
   * Returns the text with mentions replaced and the list of resolved Slack user IDs.
   */
  private async processGitHubMentions(
    text: string,
    channelId: string,
    owner: string,
    repo: string,
    installationId?: number,
    teamId?: string,
    workspaceId?: number,
  ): Promise<{ processedText: string; mentionedSlackIds: string[] }> {
    const mentions = this.extractGitHubMentions(text);
    let processedText = text;
    const mentionedSlackIds: string[] = [];
    const slackUserIdsToInvite: string[] = [];

    for (const username of mentions) {
      try {
        // Check user's preferences
        const userPrefs = await this.getUserPreferences(username, workspaceId);

        const slackUserId = await this.resolveGitHubUserToSlack(
          username,
          owner,
          repo,
          installationId,
          teamId,
          workspaceId,
        );

        if (slackUserId) {
          // Only convert to Slack mention if user hasn't opted out of mentions
          if (userPrefs.slackMentions) {
            const githubMentionRegex = new RegExp(
              `(?<![a-zA-Z0-9.])@${username}(?![a-zA-Z0-9-])`,
              "g",
            );
            processedText = processedText.replace(
              githubMentionRegex,
              `<@${slackUserId}>`,
            );
            mentionedSlackIds.push(slackUserId);
          } else {
            this.logger.debug(
              `Keeping @${username} as plain text (user opted out of mentions)`,
            );
          }

          // Only add to invite list if user hasn't opted out of invites
          if (userPrefs.slackInvites) {
            slackUserIdsToInvite.push(slackUserId);
          } else {
            this.logger.debug(
              `Skipping channel invite for @${username} (user opted out of invites)`,
            );
          }
        }
      } catch (error) {
        this.logger.warn(
          `Could not resolve mention @${username} to Slack: ${(error as Error).message}`,
        );
      }
    }

    // Invite mentioned users to the channel (only those who haven't opted out)
    if (slackUserIdsToInvite.length > 0) {
      try {
        await this.slackService.inviteToChannel(
          channelId,
          slackUserIdsToInvite,
          teamId,
        );
      } catch (error) {
        this.logger.warn(
          `Could not invite mentioned users to channel: ${(error as Error).message}`,
        );
      }
    }

    return { processedText, mentionedSlackIds };
  }
}
