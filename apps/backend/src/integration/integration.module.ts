import { Module, forwardRef } from "@nestjs/common";
import { GitHubModule } from "../github/github.module";
import { SlackModule } from "../slack/slack.module";
import { IntegrationService } from "./integration.service";

@Module({
  imports: [forwardRef(() => GitHubModule), forwardRef(() => SlackModule)],
  providers: [IntegrationService],
  exports: [IntegrationService],
})
export class IntegrationModule {}
