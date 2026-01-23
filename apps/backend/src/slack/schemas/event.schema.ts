import { z } from "zod";

// URL Verification challenge
export const urlVerificationSchema = z.object({
  type: z.literal("url_verification"),
  challenge: z.string(),
  token: z.string(),
});

// Message event
const messageEventSchema = z.object({
  type: z.literal("message"),
  channel: z.string(),
  user: z.string().optional(),
  text: z.string(),
  ts: z.string(),
  bot_id: z.string().optional(),
  subtype: z.string().optional(),
  thread_ts: z.string().optional(),
});

// Event callback wrapper
export const eventCallbackSchema = z.object({
  type: z.literal("event_callback"),
  token: z.string(),
  team_id: z.string(),
  api_app_id: z.string(),
  event: messageEventSchema,
  event_id: z.string(),
  event_time: z.number(),
});

// Combined schema for all Slack events
export const slackEventSchema = z.discriminatedUnion("type", [
  urlVerificationSchema,
  eventCallbackSchema,
]);

export type UrlVerificationEvent = z.infer<typeof urlVerificationSchema>;
export type EventCallbackEvent = z.infer<typeof eventCallbackSchema>;
export type SlackEvent = z.infer<typeof slackEventSchema>;
export type MessageEvent = z.infer<typeof messageEventSchema>;
