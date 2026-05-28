-- CreateTable
CREATE TABLE "TwoFA" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "TwoFA_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TwoFABackupCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "TwoFABackupCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TwoFA_userId_key" ON "TwoFA"("userId");

-- CreateIndex
CREATE INDEX "TwoFA_isEnabled_idx" ON "TwoFA"("isEnabled");

-- CreateIndex
CREATE INDEX "TwoFA_lockedUntil_idx" ON "TwoFA"("lockedUntil");

-- CreateIndex
CREATE INDEX "TwoFA_deletedAt_idx" ON "TwoFA"("deletedAt");

-- CreateIndex
CREATE INDEX "TwoFABackupCode_userId_idx" ON "TwoFABackupCode"("userId");

-- CreateIndex
CREATE INDEX "TwoFABackupCode_userId_isUsed_idx" ON "TwoFABackupCode"("userId", "isUsed");

-- CreateIndex
CREATE INDEX "TwoFABackupCode_deletedAt_idx" ON "TwoFABackupCode"("deletedAt");

-- AddForeignKey
ALTER TABLE "TwoFA" ADD CONSTRAINT "TwoFA_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TwoFABackupCode" ADD CONSTRAINT "TwoFABackupCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
