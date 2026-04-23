-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "passwordResetRequestedAt" TIMESTAMP(3),
ADD COLUMN     "passwordResetTokenExpiresAt" TIMESTAMP(3),
ADD COLUMN     "passwordResetTokenHash" TEXT;
