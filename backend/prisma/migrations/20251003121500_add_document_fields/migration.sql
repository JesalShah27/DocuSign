-- CreateTable
CREATE TABLE "DocumentField" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "envelopeId" TEXT NOT NULL,
    "signerId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "page" INTEGER NOT NULL,
    "x" REAL NOT NULL,
    "y" REAL NOT NULL,
    "width" REAL NOT NULL,
    "height" REAL NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "value" TEXT,
    "label" TEXT,
    "fontFamily" TEXT,
    "fontSize" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DocumentField_envelopeId_fkey" FOREIGN KEY ("envelopeId") REFERENCES "Envelope" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DocumentField_signerId_fkey" FOREIGN KEY ("signerId") REFERENCES "EnvelopeSigner" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "DocumentField_envelopeId_idx" ON "DocumentField"("envelopeId");
CREATE INDEX "DocumentField_signerId_idx" ON "DocumentField"("signerId");