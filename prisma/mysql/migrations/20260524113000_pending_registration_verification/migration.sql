CREATE TABLE `PendingUserRegistration` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `username` VARCHAR(191) NOT NULL,
    `passwordHash` LONGTEXT NOT NULL,
    `displayName` VARCHAR(191) NULL,
    `verificationTokenHash` VARCHAR(191) NOT NULL,
    `verificationCodeHash` VARCHAR(191) NOT NULL,
    `verificationExpiresAt` DATETIME(3) NOT NULL,
    `verificationRequestedAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`),
    UNIQUE INDEX `PendingUserRegistration_email_key`(`email`),
    UNIQUE INDEX `PendingUserRegistration_verificationTokenHash_key`(`verificationTokenHash`),
    INDEX `PendingUserRegistration_username_idx`(`username`),
    INDEX `PendingUserRegistration_verificationExpiresAt_idx`(`verificationExpiresAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
