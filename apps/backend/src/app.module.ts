import { Module } from "@nestjs/common";
import { AdminModule } from "./admin/admin.module";
import { AppController } from "./app.controller";
import { AuthModule } from "./auth";
import { ConfigModule } from "./config";
import { DatabaseModule } from "./database";
import { IntegrationModule } from "./integration";
import { OAuthModule } from "./oauth/oauth.module";
import { PreferencesModule } from "./preferences";

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    AuthModule,
    IntegrationModule,
    AdminModule,
    OAuthModule,
    PreferencesModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
