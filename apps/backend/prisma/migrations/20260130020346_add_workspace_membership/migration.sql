-- CreateTable
CREATE TABLE "workspace_memberships" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" INTEGER NOT NULL,
    "slackWorkspaceId" INTEGER NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    CONSTRAINT "workspace_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "workspace_memberships_slackWorkspaceId_fkey" FOREIGN KEY ("slackWorkspaceId") REFERENCES "slack_workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "workspace_memberships_userId_idx" ON "workspace_memberships"("userId");

-- CreateIndex
CREATE INDEX "workspace_memberships_slackWorkspaceId_idx" ON "workspace_memberships"("slackWorkspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_memberships_userId_slackWorkspaceId_key" ON "workspace_memberships"("userId", "slackWorkspaceId");
