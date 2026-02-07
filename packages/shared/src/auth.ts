import { z } from "zod";

// User roles (workspace-scoped)
export const workspaceRoleSchema = z.enum(["admin", "user"]);
export type WorkspaceRole = z.infer<typeof workspaceRoleSchema>;

// Workspace membership (user's role in a specific workspace)
export const workspaceMembershipSchema = z.object({
  workspaceId: z.number(),
  teamId: z.string(),
  teamName: z.string(),
  role: workspaceRoleSchema,
});
export type WorkspaceMembership = z.infer<typeof workspaceMembershipSchema>;

// User schema (matches Prisma User model)
export const userSchema = z.object({
  id: z.number(),
  githubId: z.number().nullable(),
  githubUsername: z.string().nullable(),
  email: z.string().nullable(),
  avatarUrl: z.string().nullable(),
});
export type User = z.infer<typeof userSchema>;

// JWT payload (stored in token)
export const jwtPayloadSchema = z.object({
  sub: z.number(), // User ID
  sid: z.string(), // Session ID (for revocation)
  githubId: z.number().nullable(),
  username: z.string(), // GitHub username or email
  currentWorkspaceId: z.number().nullable(), // Current workspace context (null if no workspace)
  iat: z.number().optional(),
  exp: z.number().optional(),
});
export type JwtPayload = z.infer<typeof jwtPayloadSchema>;

// Current user (returned by /api/auth/me)
export const currentUserSchema = z.object({
  id: z.number(),
  githubId: z.number().nullable(),
  githubUsername: z.string().nullable(),
  email: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  sessionId: z.string(),
  workspaces: z.array(workspaceMembershipSchema),
  currentWorkspace: workspaceMembershipSchema.nullable(),
});
export type CurrentUser = z.infer<typeof currentUserSchema>;

// Auth error response
export const authErrorSchema = z.object({
  statusCode: z.number(),
  message: z.string(),
  error: z.string().optional(),
});
export type AuthError = z.infer<typeof authErrorSchema>;
