-- AlterTable
ALTER TABLE "Booking" ADD COLUMN "paymentReceiptUrl" TEXT;
ALTER TABLE "Booking" ADD COLUMN "paymentSnapshot" TEXT;

-- CreateTable
CREATE TABLE "AppMeta" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Consultation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "fileUrl" TEXT,
    "extractedText" TEXT,
    "aiResult" TEXT NOT NULL,
    "followUpHistory" TEXT,
    "followUpCount" INTEGER NOT NULL DEFAULT 0,
    "isFree" BOOLEAN NOT NULL DEFAULT true,
    "trialsCharged" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Consultation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Consultation" ("aiResult", "category", "createdAt", "description", "extractedText", "fileUrl", "followUpCount", "followUpHistory", "id", "isFree", "title", "userId") SELECT "aiResult", "category", "createdAt", "description", "extractedText", "fileUrl", "followUpCount", "followUpHistory", "id", "isFree", "title", "userId" FROM "Consultation";
DROP TABLE "Consultation";
ALTER TABLE "new_Consultation" RENAME TO "Consultation";
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "googleId" TEXT,
    "role" TEXT NOT NULL DEFAULT 'CITIZEN',
    "name" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "isPremium" BOOLEAN NOT NULL DEFAULT false,
    "trialsUsed" INTEGER NOT NULL DEFAULT 0,
    "isFirstLogin" BOOLEAN NOT NULL DEFAULT true,
    "isBanned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "barNumber" TEXT,
    "specializations" TEXT,
    "consultationFee" REAL,
    "consultationFeeMin" REAL,
    "consultationFeeMax" REAL,
    "acceptingBookings" BOOLEAN NOT NULL DEFAULT true,
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
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
