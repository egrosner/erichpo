import { Injectable, Logger } from "@nestjs/common";
import { DatabaseService } from "../database";

export interface UserPreferences {
  slackMentions: boolean;
  slackInvites: boolean;
}

@Injectable()
export class PreferencesService {
  private readonly logger = new Logger(PreferencesService.name);

  constructor(private readonly db: DatabaseService) {}

  async getPreferences(
    userId: number,
    workspaceId: number,
  ): Promise<UserPreferences> {
    const membership = await this.db.workspaceMembership.findUnique({
      where: {
        userId_slackWorkspaceId: {
          userId,
          slackWorkspaceId: workspaceId,
        },
      },
      select: {
        slackMentions: true,
        slackInvites: true,
      },
    });

    if (!membership) {
      // Return defaults if no membership found
      return {
        slackMentions: true,
        slackInvites: true,
      };
    }

    return {
      slackMentions: membership.slackMentions,
      slackInvites: membership.slackInvites,
    };
  }

  async updatePreferences(
    userId: number,
    workspaceId: number,
    preferences: Partial<UserPreferences>,
  ): Promise<UserPreferences> {
    const updated = await this.db.workspaceMembership.update({
      where: {
        userId_slackWorkspaceId: {
          userId,
          slackWorkspaceId: workspaceId,
        },
      },
      data: {
        ...(preferences.slackMentions !== undefined && {
          slackMentions: preferences.slackMentions,
        }),
        ...(preferences.slackInvites !== undefined && {
          slackInvites: preferences.slackInvites,
        }),
      },
      select: {
        slackMentions: true,
        slackInvites: true,
      },
    });

    this.logger.log(
      `Updated preferences for user ${userId} in workspace ${workspaceId}: mentions=${updated.slackMentions}, invites=${updated.slackInvites}`,
    );

    return {
      slackMentions: updated.slackMentions,
      slackInvites: updated.slackInvites,
    };
  }
}
