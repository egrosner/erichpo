-- CreateTable
CREATE TABLE "slack_message_mappings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "slackChannelId" TEXT NOT NULL,
    "slackMessageTs" TEXT NOT NULL,
    "githubCommentId" INTEGER NOT NULL,
    "githubRepoOwner" TEXT NOT NULL,
    "githubRepoName" TEXT NOT NULL,
    "githubPrNumber" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "slack_message_mappings_slackChannelId_slackMessageTs_key" ON "slack_message_mappings"("slackChannelId", "slackMessageTs");
