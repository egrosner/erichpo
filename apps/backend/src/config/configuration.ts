import { z } from "zod";

const configSchema = z.object({
  port: z.coerce.number().default(4848),
  nodeEnv: z.enum(["development", "production", "test"]).default("development"),

  github: z.object({
    webhookSecret: z.string().optional(),
    appId: z.string().optional(),
    privateKey: z.string().optional(),
    clientId: z.string().optional(), // OAuth Client ID (different from App ID)
    clientSecret: z.string().optional(), // For user OAuth
    oauthCallbackUrl: z.string().optional(),
  }),

  slack: z.object({
    botToken: z.string().optional(),
    signingSecret: z.string().optional(),
    clientId: z.string().optional(),
    clientSecret: z.string().optional(),
    oauthRedirectUrl: z.string().optional(),
  }),

  database: z.object({
    url: z.string().default("file:./data/pr-channels.db"),
  }),

  channel: z.object({
    prefix: z.string().default("_pr_"),
  }),

  auth: z.object({
    jwtSecret: z.string().min(32).optional(),
    jwtExpiresIn: z.string().default("7d"),
    sessionMaxAge: z.coerce.number().default(7 * 24 * 60 * 60 * 1000), // 7 days in ms
    adminGithubIds: z.string().optional(), // Comma-separated GitHub user IDs
    cookieSecure: z.boolean().default(true),
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
        ? Buffer.from(
            process.env.GITHUB_PRIVATE_KEY_BASE64,
            "base64",
          ).toString()
        : process.env.GITHUB_PRIVATE_KEY,
      clientId: process.env.GITHUB_CLIENT_ID, // OAuth Client ID (Iv1.xxx format)
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      oauthCallbackUrl: process.env.GITHUB_OAUTH_CALLBACK_URL,
    },

    slack: {
      botToken: process.env.SLACK_BOT_TOKEN,
      signingSecret: process.env.SLACK_SIGNING_SECRET,
      clientId: process.env.SLACK_CLIENT_ID,
      clientSecret: process.env.SLACK_CLIENT_SECRET,
      oauthRedirectUrl: process.env.SLACK_OAUTH_REDIRECT_URL,
    },

    database: {
      url: process.env.DATABASE_URL,
    },

    channel: {
      prefix: process.env.SLACK_CHANNEL_PREFIX,
    },

    auth: {
      jwtSecret: process.env.JWT_SECRET,
      jwtExpiresIn: process.env.JWT_EXPIRES_IN,
      sessionMaxAge: process.env.SESSION_MAX_AGE,
      adminGithubIds: process.env.ADMIN_GITHUB_IDS,
      cookieSecure: process.env.NODE_ENV === "production",
    },
  };

  return configSchema.parse(config);
}
