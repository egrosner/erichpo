# GitHub-Slack PR Channel Integration Plan

## Configuration Choices
- **Slack Channels**: Public (anyone in workspace can see/join)
- **GitHub Auth**: GitHub App (secure, supports installations)
- **Database**: SQLite with Prisma ORM (simple, no server needed)

## Overview
Create a bidirectional integration between GitHub and Slack that:
1. Creates a temporary Slack channel when a PR is opened
2. Syncs PR events (comments, reviews, CI status) to the Slack channel
3. Posts Slack channel messages as comments on the PR

## Architecture

```
GitHub ──webhooks──► NestJS Backend ──API──► Slack
                          │
                     SQLite DB
                   (PR↔Channel map)
                          │
Slack ──Events API──► NestJS Backend ──API──► GitHub
```

## Module Structure

```
src/
├── config/           # Environment & configuration
├── database/         # SQLite + Prisma ORM
├── common/
│   └── guards/       # Webhook signature verification
├── github/           # Webhook receiver, GitHub API client
├── slack/            # Slack API client, Events API receiver
└── integration/      # Core orchestration logic
```

## Dependencies to Add

```json
{
  "dependencies": {
    "@nestjs/config": "^4.0.0",
    "@slack/web-api": "^7.0.0",
    "@octokit/rest": "^21.0.0",
    "@octokit/webhooks": "^13.0.0",
    "@prisma/client": "^6.0.0",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "prisma": "^6.0.0"
  }
}
```

## Environment Variables

```bash
# GitHub
GITHUB_WEBHOOK_SECRET=xxx
GITHUB_APP_ID=xxx
GITHUB_PRIVATE_KEY_BASE64=xxx

# Slack
SLACK_BOT_TOKEN=xoxb-xxx
SLACK_SIGNING_SECRET=xxx

# Database
DATABASE_PATH=./data/pr-channels.db

# Settings
SLACK_CHANNEL_PREFIX=pr-
```

## Database Schema

**pr_channel_mappings** table:
- `github_repo_owner`, `github_repo_name`, `github_pr_number`
- `slack_channel_id`, `slack_channel_name`
- `pr_title`, `pr_author`, `pr_url`
- `status` (open/merged/closed)
- timestamps

## Key Endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /api/webhooks/github` | Receive GitHub webhook events |
| `POST /api/webhooks/slack/events` | Receive Slack Events API |

## GitHub Events to Handle

- `pull_request` (opened, closed, reopened)
- `pull_request_review` (submitted)
- `pull_request_review_comment` (created)
- `issue_comment` (created) - PR comments
- `check_run` / `check_suite` - CI status

## Channel Lifecycle

1. **PR Opened** → Create channel `pr-{repo}-{number}-{branch}`
2. **PR Active** → Bidirectional message sync
3. **PR Closed/Merged** → Post status, schedule archive
4. **After 7 days** → Archive channel

## Implementation Order

### Phase 1: Foundation
1. Install dependencies
2. Set up config module with env vars
3. Set up database (SQLite + Prisma schema + migrations)
4. Create webhook signature guards

### Phase 2: GitHub Integration
5. Create GitHub module with webhook controller
6. Implement signature verification
7. Parse webhook events (PR opened, comments, reviews)

### Phase 3: Slack Integration
8. Create Slack module with Web API client
9. Implement channel creation, messaging
10. Set up Events API receiver for incoming messages

### Phase 4: Integration Layer
11. Create integration service to orchestrate
12. Connect GitHub events → Slack messages
13. Connect Slack messages → GitHub comments
14. Implement rich message formatting (Slack blocks)

### Phase 5: Polish
15. Add error handling and retry logic
16. Implement channel archival
17. Write tests (unit + e2e)

## Critical Files to Modify/Create

- `apps/backend/package.json` - Add dependencies
- `apps/backend/src/main.ts` - Add raw body parsing for signature verification
- `apps/backend/src/app.module.ts` - Import all feature modules
- `apps/backend/src/config/` - New config module
- `apps/backend/src/database/` - New database module
- `apps/backend/src/github/` - New GitHub module
- `apps/backend/src/slack/` - New Slack module
- `apps/backend/src/integration/` - New integration module

## Verification

1. **Unit Tests**: Run `pnpm test` - verify all services work in isolation
2. **E2E Tests**: Run `pnpm test:e2e` - verify webhook endpoints
3. **Manual Testing**:
   - Set up ngrok for local webhook testing
   - Create a test PR and verify channel creation
   - Post a comment on PR, verify it appears in Slack
   - Post a message in Slack, verify it appears on PR
   - Close PR, verify archive scheduling works
