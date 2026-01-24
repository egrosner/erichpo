import { resolve } from "path";
import {
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class DatabaseService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const rawPath =
      process.env.DATABASE_URL?.replace("file:", "") || "./data/pr-channels.db";
    const prismaDir = resolve(__dirname, "../../../prisma");
    const dbUrl = resolve(prismaDir, rawPath);
    const adapter = new PrismaBetterSqlite3({ url: dbUrl });
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
