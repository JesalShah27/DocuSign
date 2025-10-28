/*
  Warnings:

  - You are about to drop the `DocumentVersion` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `sha256Hash` on the `Document` table. All the data in the column will be lost.
  - You are about to drop the column `signedHash` on the `Document` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "DocumentVersion_documentId_version_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "DocumentVersion";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "SignatureHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "signerName" TEXT NOT NULL,
    "signerEmail" TEXT NOT NULL,
    "signatureStep" INTEGER NOT NULL,
    "completeSignedPdfPath" TEXT NOT NULL,
    "completeSignedPdfHash" TEXT NOT NULL,
    "signedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SignatureHistory_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Document" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "originalHash" TEXT,
    "completeSignedPdfHash" TEXT,
    "signedPdfPath" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Document_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Document" ("createdAt", "id", "mimeType", "originalName", "ownerId", "sizeBytes", "storagePath", "updatedAt") SELECT "createdAt", "id", "mimeType", "originalName", "ownerId", "sizeBytes", "storagePath", "updatedAt" FROM "Document";
DROP TABLE "Document";
ALTER TABLE "new_Document" RENAME TO "Document";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "SignatureHistory_documentId_signatureStep_key" ON "SignatureHistory"("documentId", "signatureStep");
