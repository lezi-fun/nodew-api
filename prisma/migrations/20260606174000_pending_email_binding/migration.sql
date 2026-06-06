-- AlterTable
ALTER TABLE "User" ADD COLUMN     "pendingEmail" TEXT,
ADD COLUMN     "pendingEmailVerificationTokenHash" TEXT,
ADD COLUMN     "pendingEmailVerificationCodeHash" TEXT,
ADD COLUMN     "pendingEmailVerificationExpiresAt" TIMESTAMP(3),
ADD COLUMN     "pendingEmailVerificationRequestedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "User_pendingEmail_key" ON "User"("pendingEmail");

-- CreateIndex
CREATE UNIQUE INDEX "User_pendingEmailVerificationTokenHash_key" ON "User"("pendingEmailVerificationTokenHash");
