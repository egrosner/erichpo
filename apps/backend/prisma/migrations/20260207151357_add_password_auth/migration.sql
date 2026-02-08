-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_users" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "githubId" INTEGER,
    "githubUsername" TEXT,
    "email" TEXT,
    "avatarUrl" TEXT,
    "githubAccessToken" TEXT,
    "passwordHash" TEXT
);
INSERT INTO "new_users" ("avatarUrl", "createdAt", "email", "githubAccessToken", "githubId", "githubUsername", "id", "updatedAt") SELECT "avatarUrl", "createdAt", "email", "githubAccessToken", "githubId", "githubUsername", "id", "updatedAt" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_githubId_key" ON "users"("githubId");
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
