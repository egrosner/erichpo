import { Module, forwardRef } from "@nestjs/common";
import { IntegrationModule } from "../integration/integration.module";
import { GitHubController } from "./github.controller";
import { GitHubService } from "./github.service";

@Module({
  imports: [forwardRef(() => IntegrationModule)],
  controllers: [GitHubController],
  providers: [GitHubService],
  exports: [GitHubService],
})
export class GitHubModule {}
