import { z } from "zod";

// User roles
export const userRoleSchema = z.enum(["admin", "user"]);
export type UserRole = z.infer<typeof userRoleSchema>;

// User schema (matches Prisma User model)
export const userSchema = z.object({
  id: z.number(),
  githubId: z.number(),
  githubUsername: z.string(),
  email: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  role: userRoleSchema,
});
export type User = z.infer<typeof userSchema>;

// JWT payload (stored in token)
export const jwtPayloadSchema = z.object({
  sub: z.number(), // User ID
  sid: z.string(), // Session ID (for revocation)
  githubId: z.number(),
  username: z.string(),
  role: userRoleSchema,
  iat: z.number().optional(),
  exp: z.number().optional(),
});
export type JwtPayload = z.infer<typeof jwtPayloadSchema>;

// Current user (returned by /api/auth/me)
export const currentUserSchema = z.object({
  id: z.number(),
  githubId: z.number(),
  githubUsername: z.string(),
  email: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  role: userRoleSchema,
  sessionId: z.string(),
});
export type CurrentUser = z.infer<typeof currentUserSchema>;

// Auth error response
export const authErrorSchema = z.object({
  statusCode: z.number(),
  message: z.string(),
  error: z.string().optional(),
});
export type AuthError = z.infer<typeof authErrorSchema>;
