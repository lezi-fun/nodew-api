-- CreateTable
CREATE TABLE `PasskeyCredential` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `credentialId` VARCHAR(512) NOT NULL,
    `publicKey` TEXT NOT NULL,
    `attestationType` VARCHAR(255) NOT NULL,
    `aaguid` VARCHAR(512) NOT NULL,
    `signCount` INTEGER NOT NULL DEFAULT 0,
    `cloneWarning` BOOLEAN NOT NULL DEFAULT false,
    `userPresent` BOOLEAN NOT NULL DEFAULT false,
    `userVerified` BOOLEAN NOT NULL DEFAULT false,
    `backupEligible` BOOLEAN NOT NULL DEFAULT false,
    `backupState` BOOLEAN NOT NULL DEFAULT false,
    `transports` TEXT NOT NULL,
    `attachment` VARCHAR(32) NOT NULL,
    `lastUsedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `PasskeyCredential_userId_key`(`userId`),
    UNIQUE INDEX `PasskeyCredential_credentialId_key`(`credentialId`),
    INDEX `PasskeyCredential_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PasskeyCredential` ADD CONSTRAINT `PasskeyCredential_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
