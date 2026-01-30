-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_workspace_memberships" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" INTEGER NOT NULL,
    "slackWorkspaceId" INTEGER NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    "slackMentions" BOOLEAN NOT NULL DEFAULT true,
    "slackInvites" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "workspace_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "workspace_memberships_slackWorkspaceId_fkey" FOREIGN KEY ("slackWorkspaceId") REFERENCES "slack_workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_workspace_memberships" ("createdAt", "id", "role", "slackWorkspaceId", "updatedAt", "userId") SELECT "createdAt", "id", "role", "slackWorkspaceId", "updatedAt", "userId" FROM "workspace_memberships";
DROP TABLE "workspace_memberships";
ALTER TABLE "new_workspace_memberships" RENAME TO "workspace_memberships";
CREATE INDEX "workspace_memberships_userId_idx" ON "workspace_memberships"("userId");
CREATE INDEX "workspace_memberships_slackWorkspaceId_idx" ON "workspace_memberships"("slackWorkspaceId");
CREATE UNIQUE INDEX "workspace_memberships_userId_slackWorkspaceId_key" ON "workspace_memberships"("userId", "slackWorkspaceId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
