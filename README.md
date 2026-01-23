# erichpo

A bidirectional GitHub-Slack integration that creates temporary Slack channels for pull requests, syncing comments and activity between both platforms.

## Features

- Automatically creates a Slack channel when a PR is opened
- Syncs PR comments, reviews, and CI status to the Slack channel
- Posts Slack channel messages as comments on the PR
- Archives channels after PRs are closed/merged

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
   - **Webhook URL**: `https://your-domain/api/webhooks/github`
   - **Webhook secret**: Generate a secret (e.g. `openssl rand -hex 32`) and save it for `.env`
3. Set **Permissions**:
   - **Repository permissions**:
     - Issues: Read & Write (needed for PR comments)
     - Pull requests: Read & Write
     - Checks: Read-only
   - **Organization permissions**: None needed
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
     - `groups:write` (if using private channels)
4. **Install the app** to your workspace:
   - Click **Install to Workspace** under OAuth & Permissions
   - Authorize the app
   - Copy the **Bot User OAuth Token** (`xoxb-...`) for `SLACK_BOT_TOKEN` in `.env`
5. Set up **Event Subscriptions**:
   - Enable Events at **Event Subscriptions**
   - Set **Request URL** to: `https://your-domain/api/webhooks/slack/events`
   - Slack will send a challenge request to verify - your server must be running
   - Under **Subscribe to bot events**, add:
     - `message.channels` (messages in public channels)
   - Save changes
6. Get the **Signing Secret**:
   - Go to **Basic Information**
   - Under **App Credentials**, copy the **Signing Secret** for `SLACK_SIGNING_SECRET` in `.env`

### 3. Configure Environment

```bash
cd apps/backend
cp .env.example .env
```

Fill in your `.env`:

```bash
PORT=3000
NODE_ENV=development

# From GitHub App setup (steps 6-7)
GITHUB_WEBHOOK_SECRET=your-generated-webhook-secret
GITHUB_APP_ID=123456
GITHUB_PRIVATE_KEY_BASE64=your-base64-encoded-private-key

# From Slack App setup (steps 4, 6)
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_SIGNING_SECRET=your-signing-secret

DATABASE_URL=file:./data/pr-channels.db
SLACK_CHANNEL_PREFIX=pr-
SLACK_CHANNEL_AUTO_ARCHIVE_HOURS=168
```

### 4. Local Development with Webhooks

Since GitHub and Slack need to reach your server, use a tunnel for local development:

```bash
# Using ngrok
ngrok http 3000

# Update your GitHub App webhook URL and Slack Events URL
# with the ngrok URL (e.g. https://abc123.ngrok.io)
```

## Project Structure

```
erichpo/
├── apps/
│   └── backend/           # NestJS backend
│       ├── src/
│       │   ├── config/    # Zod-validated configuration
│       │   ├── database/  # Prisma + SQLite
│       │   ├── common/    # Guards (signature verification)
│       │   ├── github/    # Webhook receiver & GitHub API
│       │   ├── slack/     # Slack API & Events receiver
│       │   └── integration/ # Orchestration service
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
