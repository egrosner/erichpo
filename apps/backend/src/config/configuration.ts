import { z } from "zod";

const configSchema = z.object({
  port: z.coerce.number().default(3000),
  nodeEnv: z.enum(["development", "production", "test"]).default("development"),

  github: z.object({
    webhookSecret: z.string().optional(),
    appId: z.string().optional(),
    privateKey: z.string().optional(),
  }),

  slack: z.object({
    botToken: z.string().optional(),
    signingSecret: z.string().optional(),
  }),

  database: z.object({
    url: z.string().default("file:./data/pr-channels.db"),
  }),

  channel: z.object({
    prefix: z.string().default("pr-"),
    autoArchiveHours: z.coerce.number().default(168), // 7 days
  }),
});

export type Config = z.infer<typeof configSchema>;

export function configuration(): Config {
  const config = {
    port: process.env.PORT,
    nodeEnv: process.env.NODE_ENV,

    github: {
      webhookSecret: process.env.GITHUB_WEBHOOK_SECRET,
      appId: process.env.GITHUB_APP_ID,
      privateKey: process.env.GITHUB_PRIVATE_KEY_BASE64
        ? Buffer.from(process.env.GITHUB_PRIVATE_KEY_BASE64, "base64").toString()
        : process.env.GITHUB_PRIVATE_KEY,
    },

    slack: {
      botToken: process.env.SLACK_BOT_TOKEN,
      signingSecret: process.env.SLACK_SIGNING_SECRET,
    },

    database: {
      url: process.env.DATABASE_URL,
    },

    channel: {
      prefix: process.env.SLACK_CHANNEL_PREFIX,
      autoArchiveHours: process.env.SLACK_CHANNEL_AUTO_ARCHIVE_HOURS,
    },
  };

  return configSchema.parse(config);
}
