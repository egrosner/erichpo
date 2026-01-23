-- CreateTable
CREATE TABLE "github_slack_user_mappings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "githubUsername" TEXT NOT NULL,
    "slackUserId" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "github_slack_user_mappings_githubUsername_key" ON "github_slack_user_mappings"("githubUsername");
