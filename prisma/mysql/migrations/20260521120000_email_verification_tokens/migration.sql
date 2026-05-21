-- AlterTable
ALTER TABLE `User` ADD COLUMN `emailVerificationTokenHash` VARCHAR(191) NULL,
ADD COLUMN `emailVerificationTokenExpiresAt` DATETIME(3) NULL,
ADD COLUMN `emailVerificationRequestedAt` DATETIME(3) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `User_emailVerificationTokenHash_key` ON `User`(`emailVerificationTokenHash`);
