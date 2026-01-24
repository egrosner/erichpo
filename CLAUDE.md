# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Bidirectional GitHub-Slack PR integration: creates temporary Slack channels for PRs, syncs comments/reviews/CI status between platforms, and archives channels on PR close/merge. Supports multi-org/multi-workspace tenancy — one GitHub App installed across multiple orgs, one Slack App distributed to multiple workspaces via OAuth.

## Commands

```bash
# Development (from root)
pnpm dev                    # Runs all apps in watch mode
pnpm test                   # Runs tests across all apps

# Backend-specific (from apps/backend/)
pnpm build                  # Build with NestJS/SWC
pnpm dev                    # Watch mode
pnpm lint                   # Biome lint with auto-fix
pnpm format                 # Biome format with auto-fix
pnpm check                  # Biome lint + format combined
pnpm test                   # Vitest unit tests
pnpm test:watch             # Vitest watch mode
pnpm test:e2e               # E2E tests (vitest.config.e2e.ts)

# Database
npx prisma migrate dev      # Create/apply migrations (development)
npx prisma migrate deploy   # Apply migrations (production)
npx prisma generate         # Regenerate Prisma client
```

## Architecture

```
GitHub Webhooks → NestJS Backend ← Slack Events
                       ↓
                  SQLite (Prisma)
```

**Workspace:** pnpm monorepo (`apps/*`, `packages/*`). Currently only `apps/backend`.

**Module dependency graph (no circular deps, no forwardRef):**
```
AppModule
├── ConfigModule (Global) — Zod-validated env config
├── DatabaseModule (Global) — PrismaClient with better-sqlite3
├── IntegrationModule
│   ├── imports: GitHubModule, SlackModule
│   ├── controllers: GitHubController, SlackController
│   └── providers: IntegrationService (orchestrates all webhook flows)
├── AdminModule
│   ├── imports: GitHubModule, SlackModule
│   └── providers: AdminService (user/workspace mapping management)
└── OAuthModule
    ├── imports: SlackModule
    ├── controllers: OAuthController
    └── providers: OAuthService (Slack OAuth install flow)
```

GitHub/Slack modules are **pure service modules** (no controllers). All webhook controllers live in IntegrationModule.

**Key endpoints:**
- `POST /api/webhooks/github` — GitHub webhook receiver (signature-verified)
- `POST /api/webhooks/slack/events` — Slack Events API (signature-verified)
- `GET /api/oauth/slack/install?installation_id=X` — Redirect to Slack OAuth (links a GitHub installation to a Slack workspace)
- `GET /api/oauth/slack/callback` — OAuth callback, stores workspace token + creates OrgMapping
- `GET /api/admin/workspaces` — List connected Slack workspaces
- `GET /api/admin/org-mappings` — List GitHub installation → Slack workspace links
- `GET/POST /api/admin/user-mappings` — User mapping management (workspace-scoped via `workspace_id` query param)
- `GET /api/admin/slack-users` — List Slack users (workspace-scoped via `team_id` query param)
- `GET /` — Health check

## Key Patterns

- **Multi-tenancy:** `OrgMapping` links a GitHub `installationId` to a `SlackWorkspace`. On each GitHub webhook, `resolveWorkspaceForInstallation()` determines which Slack workspace to target. SlackService maintains a per-workspace `WebClient` cache keyed by `teamId`, with fallback to `SLACK_BOT_TOKEN` env var for backwards compatibility.
- **Slack OAuth flow:** `GET /api/oauth/slack/install` redirects to Slack with `installation_id` encoded in OAuth state. The callback exchanges the code for a bot token, stores/updates the `SlackWorkspace` record, and creates the `OrgMapping`.
- **Idempotency:** `WebhookDelivery` table tracks processed event IDs (GitHub's `x-github-delivery`, Slack's `event_id`). Always check before processing.
- **User resolution:** DB cache (scoped per workspace) → GitHub profile email → commit email in repo → fallback to manual mapping via admin endpoints. Filters out `@users.noreply.github.com`.
- **Webhook guards:** HMAC-SHA256 verification with timing-safe comparison. App bootstraps with `rawBody: true` for this. Signing secrets are per-app (not per-workspace).
- **Channel naming:** `{prefix}{repo}_{prNumber}_{branch}`, sanitized to lowercase alphanumeric + underscore, max 80 chars.
- **Error philosophy:** Webhook handlers return 200 even on failures (prevents retry storms). Optional operations (user invites, archiving) use try-catch with warn logging.

## Environment

Requires Node >= 24.13.0, pnpm 10.28.1. See `apps/backend/.env.example` for all env vars. Key ones: `GITHUB_APP_ID`, `GITHUB_PRIVATE_KEY_BASE64`, `GITHUB_WEBHOOK_SECRET`, `SLACK_BOT_TOKEN` (fallback, optional with multi-workspace), `SLACK_SIGNING_SECRET`, `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_OAUTH_REDIRECT_URL`, `DATABASE_URL`. Default port: 4847.

## Commit Conventions

Use [Conventional Commits](https://www.conventionalcommits.org/). Format: `<type>(<scope>): <description>`

Types: `feat`, `fix`, `refactor`, `docs`, `chore`, `test`, `build`, `ci`

Scope is optional but encouraged (e.g., `feat(admin): add user mapping endpoint`).

## Code Quality

Uses **Biome** (not ESLint/Prettier). Run `pnpm check` for combined lint+format. Tests use **Vitest** with SWC.

## Postman Collection

The file `apps/backend/postman-collection.json` contains a Postman collection for all API endpoints. **Whenever you create or modify an endpoint, update the Postman collection to match** — add new requests, update paths/parameters/bodies, or remove deleted endpoints. Keep example payloads realistic and descriptions accurate.
