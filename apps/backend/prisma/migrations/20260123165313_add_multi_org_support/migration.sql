-- CreateTable
CREATE TABLE "slack_workspaces" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "teamId" TEXT NOT NULL,
    "teamName" TEXT NOT NULL,
    "botToken" TEXT NOT NULL,
    "botUserId" TEXT,
    "installedBy" TEXT
);

-- CreateTable
CREATE TABLE "org_mappings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "githubInstallationId" INTEGER NOT NULL,
    "githubOrgLogin" TEXT,
    "slackWorkspaceId" INTEGER NOT NULL,
    CONSTRAINT "org_mappings_slackWorkspaceId_fkey" FOREIGN KEY ("slackWorkspaceId") REFERENCES "slack_workspaces" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_github_slack_user_mappings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "githubUsername" TEXT NOT NULL,
    "slackUserId" TEXT NOT NULL,
    "slackWorkspaceId" INTEGER,
    CONSTRAINT "github_slack_user_mappings_slackWorkspaceId_fkey" FOREIGN KEY ("slackWorkspaceId") REFERENCES "slack_workspaces" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_github_slack_user_mappings" ("createdAt", "githubUsername", "id", "slackUserId", "updatedAt") SELECT "createdAt", "githubUsername", "id", "slackUserId", "updatedAt" FROM "github_slack_user_mappings";
DROP TABLE "github_slack_user_mappings";
ALTER TABLE "new_github_slack_user_mappings" RENAME TO "github_slack_user_mappings";
CREATE UNIQUE INDEX "github_slack_user_mappings_githubUsername_slackWorkspaceId_key" ON "github_slack_user_mappings"("githubUsername", "slackWorkspaceId");
CREATE TABLE "new_pr_channel_mappings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "closedAt" DATETIME,
    "archivedAt" DATETIME,
    "githubRepoOwner" TEXT NOT NULL,
    "githubRepoName" TEXT NOT NULL,
    "githubPrNumber" INTEGER NOT NULL,
    "githubPrNodeId" TEXT NOT NULL,
    "githubInstallationId" INTEGER,
    "slackChannelId" TEXT NOT NULL,
    "slackChannelName" TEXT NOT NULL,
    "slackWorkspaceId" INTEGER,
    "prTitle" TEXT NOT NULL,
    "prAuthor" TEXT NOT NULL,
    "prUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    CONSTRAINT "pr_channel_mappings_slackWorkspaceId_fkey" FOREIGN KEY ("slackWorkspaceId") REFERENCES "slack_workspaces" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_pr_channel_mappings" ("archivedAt", "closedAt", "createdAt", "githubInstallationId", "githubPrNodeId", "githubPrNumber", "githubRepoName", "githubRepoOwner", "id", "prAuthor", "prTitle", "prUrl", "slackChannelId", "slackChannelName", "status", "updatedAt") SELECT "archivedAt", "closedAt", "createdAt", "githubInstallationId", "githubPrNodeId", "githubPrNumber", "githubRepoName", "githubRepoOwner", "id", "prAuthor", "prTitle", "prUrl", "slackChannelId", "slackChannelName", "status", "updatedAt" FROM "pr_channel_mappings";
DROP TABLE "pr_channel_mappings";
ALTER TABLE "new_pr_channel_mappings" RENAME TO "pr_channel_mappings";
CREATE UNIQUE INDEX "pr_channel_mappings_slackChannelId_key" ON "pr_channel_mappings"("slackChannelId");
CREATE INDEX "pr_channel_mappings_slackChannelId_idx" ON "pr_channel_mappings"("slackChannelId");
CREATE UNIQUE INDEX "pr_channel_mappings_githubRepoOwner_githubRepoName_githubPrNumber_key" ON "pr_channel_mappings"("githubRepoOwner", "githubRepoName", "githubPrNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "slack_workspaces_teamId_key" ON "slack_workspaces"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "org_mappings_githubInstallationId_key" ON "org_mappings"("githubInstallationId");
