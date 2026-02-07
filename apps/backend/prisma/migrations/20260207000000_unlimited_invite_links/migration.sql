-- CreateTable
CREATE TABLE "invite_link_usages" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "usedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inviteLinkId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    CONSTRAINT "invite_link_usages_inviteLinkId_fkey" FOREIGN KEY ("inviteLinkId") REFERENCES "invite_links" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "invite_link_usages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "invite_link_usages_inviteLinkId_userId_key" ON "invite_link_usages"("inviteLinkId", "userId");

-- Migrate existing usage data from invite_links to invite_link_usages
INSERT INTO "invite_link_usages" ("inviteLinkId", "userId", "usedAt")
SELECT "id", "usedById", "usedAt"
FROM "invite_links"
WHERE "usedAt" IS NOT NULL AND "usedById" IS NOT NULL;

-- Add maxUses column (default 1 for existing links to preserve one-time behavior)
ALTER TABLE "invite_links" ADD COLUMN "maxUses" INTEGER;

-- Set existing links to maxUses=1 (one-time) to preserve their original behavior
UPDATE "invite_links" SET "maxUses" = 1;

-- RedefineTables (SQLite doesn't support DROP COLUMN, so we rebuild)
CREATE TABLE "new_invite_links" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "token" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "maxUses" INTEGER,
    "slackWorkspaceId" INTEGER NOT NULL,
    "createdById" INTEGER NOT NULL,
    CONSTRAINT "invite_links_slackWorkspaceId_fkey" FOREIGN KEY ("slackWorkspaceId") REFERENCES "slack_workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "invite_links_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "new_invite_links" ("id", "createdAt", "token", "expiresAt", "maxUses", "slackWorkspaceId", "createdById")
SELECT "id", "createdAt", "token", "expiresAt", "maxUses", "slackWorkspaceId", "createdById"
FROM "invite_links";

DROP TABLE "invite_links";
ALTER TABLE "new_invite_links" RENAME TO "invite_links";

-- Recreate indexes
CREATE UNIQUE INDEX "invite_links_token_key" ON "invite_links"("token");
CREATE INDEX "invite_links_token_idx" ON "invite_links"("token");
