import { Module } from "@nestjs/common";
import { SlackModule } from "../slack/slack.module";
import { OAuthController } from "./oauth.controller";
import { OAuthService } from "./oauth.service";

@Module({
  imports: [SlackModule],
  controllers: [OAuthController],
  providers: [OAuthService],
})
export class OAuthModule {}
