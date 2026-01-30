/**
 * Migration script to create initial WorkspaceMembership records.
 *
 * This script:
 * 1. Finds all users with the deprecated global role = "admin"
 * 2. Creates WorkspaceMembership records for them in all existing workspaces
 *
 * Run from apps/backend with: npx ts-node scripts/migrate-workspace-memberships.ts
 */

import { resolve } from "path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";

// Initialize Prisma with the same adapter config as the app
const rawPath =
  process.env.DATABASE_URL?.replace("file:", "") ||
  "../../database/pr-channels.db";
const dbUrl = resolve(rawPath);
const adapter = new PrismaBetterSqlite3({ url: dbUrl });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Starting workspace membership migration...");
  console.log(`Database: ${dbUrl}`);

  // Get all workspaces
  const workspaces = await prisma.slackWorkspace.findMany();
  console.log(`Found ${workspaces.length} workspace(s)`);

  if (workspaces.length === 0) {
    console.log("No workspaces found, nothing to migrate.");
    return;
  }

  // Get all users with the deprecated admin role
  const adminUsers = await prisma.user.findMany({
    where: { role: "admin" },
  });
  console.log(`Found ${adminUsers.length} user(s) with global admin role`);

  // Create memberships for admin users in all workspaces
  let createdCount = 0;
  for (const user of adminUsers) {
    for (const workspace of workspaces) {
      const existing = await prisma.workspaceMembership.findUnique({
        where: {
          userId_slackWorkspaceId: {
            userId: user.id,
            slackWorkspaceId: workspace.id,
          },
        },
      });

      if (!existing) {
        await prisma.workspaceMembership.create({
          data: {
            userId: user.id,
            slackWorkspaceId: workspace.id,
            role: "admin",
          },
        });
        console.log(
          `Created admin membership for ${user.githubUsername} in ${workspace.teamName}`,
        );
        createdCount++;
      } else {
        console.log(
          `Membership already exists for ${user.githubUsername} in ${workspace.teamName} (role: ${existing.role})`,
        );
      }
    }
  }

  console.log(`\nMigration complete. Created ${createdCount} new membership(s).`);

  // Print summary
  const totalMemberships = await prisma.workspaceMembership.count();
  console.log(`Total workspace memberships: ${totalMemberships}`);
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
