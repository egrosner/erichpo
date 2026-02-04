import { Module } from "@nestjs/common";
import { GitHubApiController } from "./github-api.controller";
import { GitHubService } from "./github.service";

@Module({
  controllers: [GitHubApiController],
  providers: [GitHubService],
  exports: [GitHubService],
})
export class GitHubModule {}
