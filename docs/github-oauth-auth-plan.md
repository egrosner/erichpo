# GitHub OAuth User Authentication

## Overview
Implement GitHub OAuth authentication for all users with role-based access control (admin/user roles). Uses the **existing GitHub App** for user OAuth (GitHub Apps support user-to-server tokens in addition to installation tokens).

## 1. Database Schema Changes
**File:** `apps/backend/prisma/schema.prisma`

Add three new models:
```prisma
model User {
  id            Int       @id @default(autoincrement())
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  githubId      Int       @unique
  githubUsername String
  email         String?
  avatarUrl     String?
  role          String    @default("user")  // "admin" | "user"
  sessions      Session[]
  @@map("users")
}

model Session {
  id         String    @id @default(uuid())
  createdAt  DateTime  @default(now())
  expiresAt  DateTime
  userId     Int
  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  userAgent  String?
  ipAddress  String?
  revokedAt  DateTime?
  @@index([userId])
  @@map("sessions")
}
```

Run: `npx prisma migrate dev --name add_user_auth`

## 2. Backend AuthModule Structure
**New directory:** `apps/backend/src/auth/`

```
auth/
  auth.module.ts      # Global module exporting guards
  auth.controller.ts  # /api/auth/* endpoints
  auth.service.ts     # OAuth flow, session management (imports from @erichpo/shared)
  guards/
    jwt-auth.guard.ts # Validates JWT from cookies/header
    roles.guard.ts    # Checks user role
  decorators/
    current-user.decorator.ts  # @CurrentUser() param decorator
    roles.decorator.ts         # @Roles('admin') decorator
    public.decorator.ts        # @Public() to skip auth
  index.ts            # Re-exports
```

Types (`JwtPayload`, `CurrentUser`, etc.) come from `@erichpo/shared`.

## 3. Configuration Updates
**File:** `apps/backend/src/config/configuration.ts`

Add to existing `github` section + new `auth` section:
```typescript
github: z.object({
  // ... existing fields ...
  clientSecret: z.string().optional(),        // NEW: for user OAuth
  oauthCallbackUrl: z.string().optional(),    // NEW: callback URL
}),

auth: z.object({
  jwtSecret: z.string().min(32).optional(),
  jwtExpiresIn: z.string().default("7d"),
  adminGithubIds: z.string().optional(),      // comma-separated GitHub user IDs
}),
```

Note: `GITHUB_APP_ID` is already configured and will be used as the OAuth client ID.

## 4. Shared Types Package
**New package:** `packages/shared`

```
packages/shared/
  package.json
  tsconfig.json
  src/
    index.ts           # Re-exports all schemas/types
    auth.ts            # Auth-related schemas
    api.ts             # API response schemas
```

**package.json:**
```json
{
  "name": "@erichpo/shared",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "dependencies": {
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "typescript": "^5.9.0"
  }
}
```

**src/auth.ts** (Zod schemas + inferred types):
```typescript
import { z } from "zod";

// User schema
export const userSchema = z.object({
  id: z.number(),
  githubId: z.number(),
  githubUsername: z.string(),
  email: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  role: z.enum(["admin", "user"]),
});
export type User = z.infer<typeof userSchema>;

// JWT payload
export const jwtPayloadSchema = z.object({
  sub: z.number(),           // User ID
  sid: z.string(),           // Session ID
  githubId: z.number(),
  username: z.string(),
  role: z.enum(["admin", "user"]),
  iat: z.number().optional(),
  exp: z.number().optional(),
});
export type JwtPayload = z.infer<typeof jwtPayloadSchema>;

// Current user (returned by /api/auth/me)
export const currentUserSchema = userSchema.pick({
  id: true,
  githubId: true,
  githubUsername: true,
  email: true,
  role: true,
}).extend({
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
```

**Usage in apps:**
```bash
# Add to backend
cd apps/backend && pnpm add @erichpo/shared

# Add to frontend
cd apps/frontend && pnpm add @erichpo/shared
```

```typescript
// Backend: apps/backend/src/auth/auth.service.ts
import { type CurrentUser, type JwtPayload, currentUserSchema } from "@erichpo/shared";

// Frontend: apps/frontend/src/lib/auth.tsx
import { type User, type CurrentUser, currentUserSchema } from "@erichpo/shared";
```

## 5. New Dependencies
**Backend:**
```bash
pnpm add jsonwebtoken cookie-parser
pnpm add -D @types/jsonwebtoken @types/cookie-parser
```

## 6. Auth Endpoints
| Endpoint | Description |
|----------|-------------|
| `GET /api/auth/github` | Redirects to GitHub OAuth |
| `GET /api/auth/github/callback` | Handles OAuth callback, sets cookie |
| `GET /api/auth/me` | Returns current user (protected) |
| `GET /api/auth/logout` | Revokes session, clears cookie |

## 7. Protect Admin Endpoints
**File:** `apps/backend/src/admin/admin.controller.ts`

Add guards at controller level:
```typescript
@Controller("api/admin")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin")
export class AdminController { ... }
```

## 8. Frontend Changes
**Files to create/modify:**

| File | Purpose |
|------|---------|
| `src/lib/auth.tsx` | AuthContext + useAuth hook |
| `src/components/protected-route.tsx` | Route protection wrapper |
| `src/routes/dashboard.tsx` | User dashboard (protected) |
| `src/routes/admin.tsx` | Admin panel (admin-only) |
| `src/routes/__root.tsx` | Wrap with AuthProvider |
| `src/routes/index.tsx` | Add login/logout buttons to header |

## 9. Environment Variables
Add to `.env`:
```bash
# GitHub App OAuth (use existing app - generate client secret in app settings)
# Client ID = your GITHUB_APP_ID (already configured)
GITHUB_CLIENT_SECRET=generate-in-github-app-settings
GITHUB_OAUTH_CALLBACK_URL=http://localhost:4847/api/auth/github/callback

# JWT
JWT_SECRET=your-32-char-minimum-secret

# Optional: bootstrap admins by GitHub user ID
ADMIN_GITHUB_IDS=12345,67890
```

**Setup in GitHub App settings:**
1. Go to your GitHub App settings
2. Under "Identifying and authorizing users", add callback URL
3. Under "Client secrets", generate a new secret → use as `GITHUB_CLIENT_SECRET`

## 10. Implementation Order
1. Create `packages/shared` with Zod schemas and types
2. Add database models + run migration
3. Add `@erichpo/shared` to backend and frontend
4. Add config schema + env vars
5. Create AuthService (follow oauth.service.ts pattern, use shared types)
6. Create guards and decorators
7. Create AuthController
8. Create AuthModule, register in app.module.ts
9. Update main.ts (add cookie-parser, CORS credentials)
10. Add @UseGuards to AdminController
11. Create frontend AuthContext (use shared types)
12. Create protected routes and dashboard/admin pages
13. Update landing page with login button

## 11. Verification Steps
1. **Backend auth flow:**
   - Visit `/api/auth/github` → redirects to GitHub
   - Complete OAuth → redirects to `/dashboard` with cookie set
   - `GET /api/auth/me` returns user info
   - `GET /api/admin/workspaces` returns 401 for non-admins

2. **Frontend flow:**
   - Landing page shows "Sign in with GitHub" button
   - After login, shows username and "Dashboard" link
   - `/dashboard` accessible when logged in
   - `/admin` only accessible to admin role

3. **Run tests:** `pnpm test` (add unit tests for AuthService)

## Key Design Decisions
- **Shared types package** (`@erichpo/shared`) with Zod schemas for frontend/backend
- **JWT in HTTP-only cookies** (XSS protection)
- **Database-backed sessions** (enables logout/revocation)
- **Reuse existing GitHub App** for user OAuth (user-to-server tokens)
- **Session ID in JWT** (`sid` claim for revocation checks)
- **Admin bootstrap via env var** (`ADMIN_GITHUB_IDS`)
