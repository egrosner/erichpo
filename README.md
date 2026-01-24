# erichpo

A bidirectional GitHub-Slack integration that creates temporary Slack channels for pull requests, syncing comments and activity between both platforms. Supports multi-org tenancy — one GitHub App across multiple orgs, one Slack App distributed to multiple workspaces.

## Features

- Automatically creates a Slack channel when a PR is opened
- Syncs PR comments, reviews, and CI status to the Slack channel
- Posts Slack channel messages as comments on the PR
- Archives channels after PRs are closed/merged
- Multi-workspace: install the Slack App into multiple workspaces via OAuth, each linked to a GitHub App installation
- Per-workspace bot tokens stored in DB (no shared `SLACK_BOT_TOKEN` required)

## Prerequisites

- Node.js >= 24.13.0
- pnpm 10.28.1

## Getting Started

```bash
pnpm install
pnpm dev
```

## Setup

### 1. Create a GitHub App

1. Go to **GitHub Settings > Developer settings > GitHub Apps > New GitHub App**
2. Fill in the details:
   - **App name**: Choose a name (e.g. `pr-slack-bridge`)
   - **Homepage URL**: Your app URL or repository URL
   - **Webhook URL**: `https://erichpo.erichgrosner.com/api/webhooks/github`
   - **Webhook secret**: Generate a secret (e.g. `openssl rand -hex 32`) and save it for `.env`
3. Set **Permissions**:
   - **Repository permissions**:
     - Issues: Read & Write (needed for PR comments)
     - Pull requests: Read & Write
     - Checks: Read-only
   - **Organization permissions**:
     - Members: Read-only (needed to resolve team reviewers)
4. Subscribe to **events**:
   - Pull request
   - Pull request review
   - Pull request review comment
   - Issue comment
   - Check run
5. Click **Create GitHub App**
6. After creation, note the **App ID** from the app settings page
7. Generate a **Private Key**:
   - Scroll to the bottom of the app settings
   - Click **Generate a private key**
   - A `.pem` file will be downloaded
   - Base64 encode it: `base64 -w 0 your-app.pem`
   - Save the encoded value for `GITHUB_PRIVATE_KEY_BASE64` in `.env`
8. **Install the app** on your repository:
   - Go to your app's settings page
   - Click **Install App** in the sidebar
   - Choose the account/org and select repositories

### 2. Create a Slack App

1. Go to **https://api.slack.com/apps** and click **Create New App**
2. Choose **From scratch**, give it a name, and select your workspace
3. Set up **OAuth & Permissions**:
   - Under **Bot Token Scopes**, add:
     - `channels:manage` (create and archive channels)
     - `channels:read` (read channel info)
     - `chat:write` (post messages)
     - `users:read` (get user info for attribution)
     - `users:read.email` (lookup users by email for channel invites)
   - Set **Redirect URLs** to: `https://erichpo.erichgrosner.com/api/oauth/slack/callback`
4. Set up **Event Subscriptions**:
   - Enable Events at **Event Subscriptions**
   - Set **Request URL** to: `https://erichpo.erichgrosner.com/api/webhooks/slack/events`
   - Slack will send a challenge request to verify - your server must be running
   - Under **Subscribe to bot events**, add:
     - `message.channels` (messages in public channels)
   - Save changes
5. Get the **App Credentials** from **Basic Information**:
   - Copy the **Client ID** for `SLACK_CLIENT_ID` in `.env`
   - Copy the **Client Secret** for `SLACK_CLIENT_SECRET` in `.env`
   - Copy the **Signing Secret** for `SLACK_SIGNING_SECRET` in `.env`
6. **Install to workspaces** via the OAuth flow:
   - Visit `https://erichpo.erichgrosner.com/api/oauth/slack/install?installation_id=<github_installation_id>`
   - This redirects to Slack's OAuth consent screen
   - After authorization, the bot token is stored in the DB and the workspace is linked to the GitHub installation
   - Repeat for each workspace you want to connect

> **Fallback mode:** You can still set `SLACK_BOT_TOKEN` in `.env` for single-workspace setups or as a fallback when no workspace is found in the DB.

### 3. Configure Environment

```bash
cd apps/backend
cp .env.example .env
```

Fill in your `.env`:

```bash
PORT=4847
NODE_ENV=development

# From GitHub App setup (steps 6-7)
GITHUB_WEBHOOK_SECRET=your-generated-webhook-secret
GITHUB_APP_ID=123456
GITHUB_PRIVATE_KEY_BASE64=your-base64-encoded-private-key

# From Slack App setup (step 5)
SLACK_SIGNING_SECRET=your-signing-secret
SLACK_CLIENT_ID=your-slack-client-id
SLACK_CLIENT_SECRET=your-slack-client-secret
SLACK_OAUTH_REDIRECT_URL=https://erichpo.erichgrosner.com/api/oauth/slack/callback

# Optional: fallback bot token for single-workspace mode
SLACK_BOT_TOKEN=xoxb-your-bot-token

DATABASE_URL=file:./data/pr-channels.db
SLACK_CHANNEL_PREFIX=_pr_
```

### 4. Local Development with Webhooks

Since GitHub and Slack need to reach your server, use a tunnel for local development:

```bash
# Using ngrok
ngrok http 4847

# Update your GitHub App webhook URL and Slack Events URL
# with the ngrok URL (e.g. https://abc123.ngrok.io)
```

In production, the app is hosted at `https://erichpo.erichgrosner.com`.

## Project Structure

```
erichpo/
├── apps/
│   └── backend/           # NestJS backend
│       ├── src/
│       │   ├── config/    # Zod-validated configuration
│       │   ├── database/  # Prisma + SQLite
│       │   ├── common/    # Guards (signature verification)
│       │   ├── github/    # GitHub API service
│       │   ├── slack/     # Slack API service & Events controller
│       │   ├── integration/ # Webhook orchestration (GitHub↔Slack)
│       │   ├── oauth/     # Slack OAuth install flow
│       │   └── admin/     # Workspace & user mapping management
│       └── prisma/        # Schema & migrations
└── packages/              # Shared packages
```

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all apps in watch mode |
| `pnpm test` | Run tests across all apps |

### Backend-specific

| Command | Description |
|---------|-------------|
| `pnpm --filter backend test` | Run unit tests |
| `pnpm --filter backend test:e2e` | Run e2e tests |
| `pnpm --filter backend build` | Build for production |
| `pnpm --filter backend check` | Lint & format with Biome |
