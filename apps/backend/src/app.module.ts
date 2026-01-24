import { Module } from "@nestjs/common";
import { AdminModule } from "./admin/admin.module";
import { AppController } from "./app.controller";
import { ConfigModule } from "./config";
import { DatabaseModule } from "./database";
import { IntegrationModule } from "./integration";
import { OAuthModule } from "./oauth/oauth.module";

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    IntegrationModule,
    AdminModule,
    OAuthModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
