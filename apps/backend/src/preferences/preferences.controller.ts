import type { CurrentUser } from "@erichpo/shared";
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  UseGuards,
} from "@nestjs/common";
import { GetCurrentUser, JwtAuthGuard } from "../auth";
import type {
  PreferencesService,
  UserPreferences,
} from "./preferences.service";

@Controller("api/preferences")
@UseGuards(JwtAuthGuard)
export class PreferencesController {
  constructor(private readonly preferencesService: PreferencesService) {}

  @Get()
  async getPreferences(
    @GetCurrentUser() user: CurrentUser,
  ): Promise<UserPreferences> {
    if (!user.currentWorkspace) {
      throw new BadRequestException("No workspace context set");
    }
    return this.preferencesService.getPreferences(
      user.id,
      user.currentWorkspace.workspaceId,
    );
  }

  @Patch()
  async updatePreferences(
    @GetCurrentUser() user: CurrentUser,
    @Body() body: Partial<UserPreferences>,
  ): Promise<UserPreferences> {
    if (!user.currentWorkspace) {
      throw new BadRequestException("No workspace context set");
    }

    // Validate that at least one preference is being updated
    if (body.slackMentions === undefined && body.slackInvites === undefined) {
      throw new BadRequestException(
        "At least one preference must be provided (slackMentions or slackInvites)",
      );
    }

    // Validate types
    if (
      body.slackMentions !== undefined &&
      typeof body.slackMentions !== "boolean"
    ) {
      throw new BadRequestException("slackMentions must be a boolean");
    }
    if (
      body.slackInvites !== undefined &&
      typeof body.slackInvites !== "boolean"
    ) {
      throw new BadRequestException("slackInvites must be a boolean");
    }

    return this.preferencesService.updatePreferences(
      user.id,
      user.currentWorkspace.workspaceId,
      body,
    );
  }
}
