-- CreateTable
CREATE TABLE "check_run_results" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "checkRunId" INTEGER NOT NULL,
    "headSha" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "conclusion" TEXT,
    "detailsUrl" TEXT NOT NULL,
    "prChannelMappingId" INTEGER NOT NULL,
    CONSTRAINT "check_run_results_prChannelMappingId_fkey" FOREIGN KEY ("prChannelMappingId") REFERENCES "pr_channel_mappings" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ci_status_messages" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "headSha" TEXT NOT NULL,
    "slackChannelId" TEXT NOT NULL,
    "slackMessageTs" TEXT NOT NULL,
    "prChannelMappingId" INTEGER NOT NULL,
    CONSTRAINT "ci_status_messages_prChannelMappingId_fkey" FOREIGN KEY ("prChannelMappingId") REFERENCES "pr_channel_mappings" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "check_run_results_checkRunId_prChannelMappingId_key" ON "check_run_results"("checkRunId", "prChannelMappingId");

-- CreateIndex
CREATE INDEX "check_run_results_headSha_prChannelMappingId_idx" ON "check_run_results"("headSha", "prChannelMappingId");

-- CreateIndex
CREATE UNIQUE INDEX "ci_status_messages_headSha_prChannelMappingId_key" ON "ci_status_messages"("headSha", "prChannelMappingId");
