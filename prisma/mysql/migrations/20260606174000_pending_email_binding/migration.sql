-- AlterTable
ALTER TABLE `User` ADD COLUMN `pendingEmail` VARCHAR(191) NULL,
ADD COLUMN `pendingEmailVerificationTokenHash` VARCHAR(191) NULL,
ADD COLUMN `pendingEmailVerificationCodeHash` VARCHAR(191) NULL,
ADD COLUMN `pendingEmailVerificationExpiresAt` DATETIME(3) NULL,
ADD COLUMN `pendingEmailVerificationRequestedAt` DATETIME(3) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `User_pendingEmail_key` ON `User`(`pendingEmail`);

-- CreateIndex
CREATE UNIQUE INDEX `User_pendingEmailVerificationTokenHash_key` ON `User`(`pendingEmailVerificationTokenHash`);
