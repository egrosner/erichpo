import { Module } from "@nestjs/common";
import { GitHubModule } from "../github/github.module";
import { SlackModule } from "../slack/slack.module";
import { AdminController } from "./admin.controller";

@Module({
  imports: [GitHubModule, SlackModule],
  controllers: [AdminController],
})
export class AdminModule {}
