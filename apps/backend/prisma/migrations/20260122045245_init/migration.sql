-- CreateTable
CREATE TABLE "pr_channel_mappings" (
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
    "prTitle" TEXT NOT NULL,
    "prAuthor" TEXT NOT NULL,
    "prUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open'
);

-- CreateTable
CREATE TABLE "webhook_deliveries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "processedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "pr_channel_mappings_slackChannelId_key" ON "pr_channel_mappings"("slackChannelId");

-- CreateIndex
CREATE INDEX "pr_channel_mappings_slackChannelId_idx" ON "pr_channel_mappings"("slackChannelId");

-- CreateIndex
CREATE UNIQUE INDEX "pr_channel_mappings_githubRepoOwner_githubRepoName_githubPrNumber_key" ON "pr_channel_mappings"("githubRepoOwner", "githubRepoName", "githubPrNumber");
