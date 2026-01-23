import { Module } from "@nestjs/common";
import { ConfigModule } from "./config";
import { DatabaseModule } from "./database";
import { GitHubModule } from "./github";
import { IntegrationModule } from "./integration";
import { SlackModule } from "./slack";

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    GitHubModule,
    SlackModule,
    IntegrationModule,
  ],
})
export class AppModule {}
