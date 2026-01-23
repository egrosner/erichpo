import { Global, Module } from "@nestjs/common";
import { ConfigModule as NestConfigModule } from "@nestjs/config";
import { configuration } from "./configuration";

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      load: [configuration],
      isGlobal: true,
    }),
  ],
})
export class ConfigModule {}
