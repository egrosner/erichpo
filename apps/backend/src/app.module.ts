import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { ConfigModule } from "./config";
import { DatabaseModule } from "./database";
import { AdminModule } from "./integration/admin.module";
import { IntegrationModule } from "./integration";

@Module({
  imports: [ConfigModule, DatabaseModule, IntegrationModule, AdminModule],
  controllers: [AppController],
})
export class AppModule {}
