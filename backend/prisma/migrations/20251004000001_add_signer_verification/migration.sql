/*
  Warnings:

  - Added the required column `otpExpiry` to the `EnvelopeSigner` table without a default value
  - Added the required column `sessionExpiry` to the `EnvelopeSigner` table without a default value

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_EnvelopeSigner" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "envelopeId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'SIGNER',
  "routingOrder" INTEGER NOT NULL DEFAULT 1,
  "accessCode" TEXT,
  "otpCode" TEXT,
  "otpExpiry" DATETIME,
  "otpVerified" BOOLEAN NOT NULL DEFAULT false,
  "sessionToken" TEXT,
  "sessionExpiry" DATETIME,
  "signingLink" TEXT NOT NULL,
  "signedAt" DATETIME,
  "declinedAt" DATETIME,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "geo" TEXT,
  CONSTRAINT "EnvelopeSigner_envelopeId_fkey" FOREIGN KEY ("envelopeId") REFERENCES "Envelope" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_EnvelopeSigner" ("id", "envelopeId", "email", "name", "role", "routingOrder", "accessCode", "signingLink", "signedAt", "declinedAt", "ipAddress", "userAgent", "geo")
  SELECT "id", "envelopeId", "email", "name", "role", "routingOrder", "accessCode", "signingLink", "signedAt", "declinedAt", "ipAddress", "userAgent", "geo"
  FROM "EnvelopeSigner";
DROP TABLE "EnvelopeSigner";
ALTER TABLE "new_EnvelopeSigner" RENAME TO "EnvelopeSigner";
CREATE UNIQUE INDEX "EnvelopeSigner_signingLink_key" ON "EnvelopeSigner"("signingLink");
CREATE UNIQUE INDEX "EnvelopeSigner_sessionToken_key" ON "EnvelopeSigner"("sessionToken");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;