-- CreateTable
CREATE TABLE "PasskeyCredential" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "credentialId" VARCHAR(512) NOT NULL,
    "publicKey" TEXT NOT NULL,
    "attestationType" VARCHAR(255) NOT NULL,
    "aaguid" VARCHAR(512) NOT NULL,
    "signCount" INTEGER NOT NULL DEFAULT 0,
    "cloneWarning" BOOLEAN NOT NULL DEFAULT false,
    "userPresent" BOOLEAN NOT NULL DEFAULT false,
    "userVerified" BOOLEAN NOT NULL DEFAULT false,
    "backupEligible" BOOLEAN NOT NULL DEFAULT false,
    "backupState" BOOLEAN NOT NULL DEFAULT false,
    "transports" TEXT NOT NULL,
    "attachment" VARCHAR(32) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PasskeyCredential_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PasskeyCredential_userId_key" ON "PasskeyCredential"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PasskeyCredential_credentialId_key" ON "PasskeyCredential"("credentialId");

-- CreateIndex
CREATE INDEX "PasskeyCredential_deletedAt_idx" ON "PasskeyCredential"("deletedAt");

-- AddForeignKey
ALTER TABLE "PasskeyCredential" ADD CONSTRAINT "PasskeyCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
