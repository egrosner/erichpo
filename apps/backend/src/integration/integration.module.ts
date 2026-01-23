import { Module, forwardRef } from "@nestjs/common";
import { GitHubModule } from "../github/github.module";
import { SlackModule } from "../slack/slack.module";
import { AdminController } from "./admin.controller";
import { IntegrationService } from "./integration.service";

@Module({
  imports: [forwardRef(() => GitHubModule), forwardRef(() => SlackModule)],
  controllers: [AdminController],
  providers: [IntegrationService],
  exports: [IntegrationService],
})
export class IntegrationModule {}
