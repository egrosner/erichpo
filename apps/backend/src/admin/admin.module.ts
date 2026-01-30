import { Module } from "@nestjs/common";
import { GitHubModule } from "../github/github.module";
import { InviteModule } from "../invite/invite.module";
import { SlackModule } from "../slack/slack.module";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";

@Module({
  imports: [GitHubModule, SlackModule, InviteModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
