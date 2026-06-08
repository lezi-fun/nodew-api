CREATE TABLE `TopUpOrder` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `provider` ENUM('STRIPE') NOT NULL DEFAULT 'STRIPE',
    `status` ENUM('PENDING', 'PAID', 'CANCELED', 'EXPIRED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `quotaAmount` BIGINT NOT NULL,
    `amountCents` INTEGER NOT NULL,
    `currency` VARCHAR(16) NOT NULL,
    `stripeSessionId` VARCHAR(255) NULL,
    `stripePaymentIntentId` VARCHAR(255) NULL,
    `metadata` JSON NULL,
    `paidAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`),
    UNIQUE INDEX `TopUpOrder_stripeSessionId_key`(`stripeSessionId`),
    UNIQUE INDEX `TopUpOrder_stripePaymentIntentId_key`(`stripePaymentIntentId`),
    INDEX `TopUpOrder_userId_idx`(`userId`),
    INDEX `TopUpOrder_provider_idx`(`provider`),
    INDEX `TopUpOrder_status_idx`(`status`),
    INDEX `TopUpOrder_createdAt_idx`(`createdAt`),
    CONSTRAINT `TopUpOrder_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
