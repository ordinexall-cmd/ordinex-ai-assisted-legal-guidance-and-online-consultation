-- CreateTable
CREATE TABLE "OtpChallenge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "phone" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PendingRegistration" (
    "phone" TEXT NOT NULL PRIMARY KEY,
    "payload" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'CITIZEN',
    "name" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "isPremium" BOOLEAN NOT NULL DEFAULT false,
    "trialsUsed" INTEGER NOT NULL DEFAULT 0,
    "isFirstLogin" BOOLEAN NOT NULL DEFAULT true,
    "isBanned" BOOLEAN NOT NULL DEFAULT false,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "barNumber" TEXT,
    "specializations" TEXT,
    "consultationFee" REAL,
    "bio" TEXT,
    "yearsOfExperience" INTEGER,
    "practiceType" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "avatarUrl" TEXT,
    "paymentMethods" TEXT,
    "credentials" TEXT,
    "rating" REAL NOT NULL DEFAULT 0,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "noShowStrikes" INTEGER NOT NULL DEFAULT 0
);
INSERT INTO "new_User" ("avatarUrl", "barNumber", "bio", "consultationFee", "createdAt", "credentials", "email", "id", "isBanned", "isFirstLogin", "isPremium", "isVerified", "language", "name", "noShowStrikes", "passwordHash", "paymentMethods", "phone", "practiceType", "rating", "ratingCount", "role", "specializations", "trialsUsed", "updatedAt", "yearsOfExperience") SELECT "avatarUrl", "barNumber", "bio", "consultationFee", "createdAt", "credentials", "email", "id", "isBanned", "isFirstLogin", "isPremium", "isVerified", "language", "name", "noShowStrikes", "passwordHash", "paymentMethods", "phone", "practiceType", "rating", "ratingCount", "role", "specializations", "trialsUsed", "updatedAt", "yearsOfExperience" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "OtpChallenge_phone_purpose_key" ON "OtpChallenge"("phone", "purpose");
