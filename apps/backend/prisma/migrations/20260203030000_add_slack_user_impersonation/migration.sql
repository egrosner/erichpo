-- AlterTable
ALTER TABLE "workspace_memberships" ADD COLUMN "slackUserId" TEXT;
ALTER TABLE "workspace_memberships" ADD COLUMN "slackAccessToken" TEXT;

-- CreateIndex
CREATE INDEX "workspace_memberships_slackUserId_slackWorkspaceId_idx" ON "workspace_memberships"("slackUserId", "slackWorkspaceId");
