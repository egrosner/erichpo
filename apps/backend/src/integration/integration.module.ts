import { Module } from "@nestjs/common";
import { GitHubController } from "../github/github.controller";
import { GitHubModule } from "../github/github.module";
import { SlackController } from "../slack/slack.controller";
import { SlackModule } from "../slack/slack.module";
import { IntegrationService } from "./integration.service";

@Module({
  imports: [GitHubModule, SlackModule],
  controllers: [GitHubController, SlackController],
  providers: [IntegrationService],
  exports: [IntegrationService],
})
export class IntegrationModule {}
