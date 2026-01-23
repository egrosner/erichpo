import { Module, forwardRef } from "@nestjs/common";
import { IntegrationModule } from "../integration/integration.module";
import { SlackController } from "./slack.controller";
import { SlackService } from "./slack.service";

@Module({
  imports: [forwardRef(() => IntegrationModule)],
  controllers: [SlackController],
  providers: [SlackService],
  exports: [SlackService],
})
export class SlackModule {}
