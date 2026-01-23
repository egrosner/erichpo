import { z } from "zod";

const userSchema = z.object({
  login: z.string(),
  id: z.number(),
  avatar_url: z.string().optional(),
});

const repositorySchema = z.object({
  id: z.number(),
  name: z.string(),
  full_name: z.string(),
  owner: userSchema,
});

const pullRequestSchema = z.object({
  number: z.number(),
  title: z.string(),
  body: z.string().nullable(),
  state: z.enum(["open", "closed"]),
  merged: z.boolean().optional(),
  html_url: z.string(),
  user: userSchema,
  head: z.object({
    ref: z.string(),
    sha: z.string(),
  }),
  base: z.object({
    ref: z.string(),
    sha: z.string(),
  }),
  additions: z.number().optional(),
  deletions: z.number().optional(),
  changed_files: z.number().optional(),
  node_id: z.string(),
});

const commentSchema = z.object({
  id: z.number(),
  body: z.string(),
  user: userSchema,
  html_url: z.string(),
  created_at: z.string(),
});

const reviewSchema = z.object({
  id: z.number(),
  body: z.string().nullable(),
  state: z.enum([
    "approved",
    "changes_requested",
    "commented",
    "dismissed",
    "pending",
  ]),
  user: userSchema,
  html_url: z.string(),
});

const installationSchema = z
  .object({
    id: z.number(),
  })
  .optional();

// Pull Request Events
export const pullRequestEventSchema = z.object({
  action: z.enum([
    "opened",
    "closed",
    "reopened",
    "edited",
    "synchronize",
    "ready_for_review",
    "converted_to_draft",
  ]),
  number: z.number(),
  pull_request: pullRequestSchema,
  repository: repositorySchema,
  sender: userSchema,
  installation: installationSchema,
});

// Issue Comment Events (PR comments appear here)
export const issueCommentEventSchema = z.object({
  action: z.enum(["created", "edited", "deleted"]),
  issue: z.object({
    number: z.number(),
    title: z.string(),
    pull_request: z.object({ url: z.string() }).optional(),
  }),
  comment: commentSchema,
  repository: repositorySchema,
  sender: userSchema,
  installation: installationSchema,
});

// PR Review Events
export const pullRequestReviewEventSchema = z.object({
  action: z.enum(["submitted", "edited", "dismissed"]),
  review: reviewSchema,
  pull_request: pullRequestSchema,
  repository: repositorySchema,
  sender: userSchema,
  installation: installationSchema,
});

// PR Review Comment Events
export const pullRequestReviewCommentEventSchema = z.object({
  action: z.enum(["created", "edited", "deleted"]),
  comment: commentSchema.extend({
    path: z.string(),
    diff_hunk: z.string().optional(),
  }),
  pull_request: pullRequestSchema,
  repository: repositorySchema,
  sender: userSchema,
  installation: installationSchema,
});

// Check Run Events
export const checkRunEventSchema = z.object({
  action: z.enum(["created", "completed", "rerequested", "requested_action"]),
  check_run: z.object({
    id: z.number(),
    name: z.string(),
    status: z.enum(["queued", "in_progress", "completed"]),
    conclusion: z
      .enum([
        "success",
        "failure",
        "neutral",
        "cancelled",
        "skipped",
        "timed_out",
        "action_required",
      ])
      .nullable(),
    html_url: z.string(),
    pull_requests: z.array(
      z.object({
        number: z.number(),
      })
    ),
  }),
  repository: repositorySchema,
  sender: userSchema,
  installation: installationSchema,
});

export type PullRequestEvent = z.infer<typeof pullRequestEventSchema>;
export type IssueCommentEvent = z.infer<typeof issueCommentEventSchema>;
export type PullRequestReviewEvent = z.infer<
  typeof pullRequestReviewEventSchema
>;
export type PullRequestReviewCommentEvent = z.infer<
  typeof pullRequestReviewCommentEventSchema
>;
export type CheckRunEvent = z.infer<typeof checkRunEventSchema>;
