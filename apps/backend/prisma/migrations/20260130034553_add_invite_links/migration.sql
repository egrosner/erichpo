-- CreateTable
CREATE TABLE "invite_links" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "token" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "usedById" INTEGER,
    "slackWorkspaceId" INTEGER NOT NULL,
    "createdById" INTEGER NOT NULL,
    CONSTRAINT "invite_links_usedById_fkey" FOREIGN KEY ("usedById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "invite_links_slackWorkspaceId_fkey" FOREIGN KEY ("slackWorkspaceId") REFERENCES "slack_workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "invite_links_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "invite_links_token_key" ON "invite_links"("token");

-- CreateIndex
CREATE INDEX "invite_links_token_idx" ON "invite_links"("token");
