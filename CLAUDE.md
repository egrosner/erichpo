# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Bidirectional GitHub-Slack PR integration: creates temporary Slack channels for PRs, syncs comments/reviews/CI status between platforms, and archives channels on PR close/merge.

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
└── AdminModule
    ├── imports: GitHubModule, SlackModule
    └── providers: AdminService (user mapping management)
```

GitHub/Slack modules are **pure service modules** (no controllers). All webhook controllers live in IntegrationModule.

**Key endpoints:**
- `POST /api/webhooks/github` — GitHub webhook receiver (signature-verified)
- `POST /api/webhooks/slack/events` — Slack Events API (signature-verified)
- `GET/POST /api/admin/*` — User mapping and lookup endpoints
- `GET /` — Health check

## Key Patterns

- **Idempotency:** `WebhookDelivery` table tracks processed event IDs (GitHub's `x-github-delivery`, Slack's `event_id`). Always check before processing.
- **User resolution:** DB cache → GitHub profile email → commit email in repo → fallback to manual mapping via admin endpoints. Filters out `@users.noreply.github.com`.
- **Webhook guards:** HMAC-SHA256 verification with timing-safe comparison. App bootstraps with `rawBody: true` for this.
- **Channel naming:** `{prefix}{repo}_{prNumber}_{branch}`, sanitized to lowercase alphanumeric + underscore, max 80 chars.
- **Error philosophy:** Webhook handlers return 200 even on failures (prevents retry storms). Optional operations (user invites, archiving) use try-catch with warn logging.

## Environment

Requires Node >= 24.13.0, pnpm 10.28.1. See `apps/backend/.env.example` for all env vars. Key ones: `GITHUB_APP_ID`, `GITHUB_PRIVATE_KEY_BASE64`, `GITHUB_WEBHOOK_SECRET`, `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`, `DATABASE_URL`. Default port: 4847.

## Commit Conventions

Use [Conventional Commits](https://www.conventionalcommits.org/). Format: `<type>(<scope>): <description>`

Types: `feat`, `fix`, `refactor`, `docs`, `chore`, `test`, `build`, `ci`

Scope is optional but encouraged (e.g., `feat(admin): add user mapping endpoint`).

## Code Quality

Uses **Biome** (not ESLint/Prettier). Run `pnpm check` for combined lint+format. Tests use **Vitest** with SWC.
