-- CreateTable
CREATE TABLE `UserCheckinRecord` (
    `id` varchar(191) NOT NULL,
    `userId` varchar(191) NOT NULL,
    `checkinDate` varchar(191) NOT NULL,
    `rewardQuota` bigint NOT NULL DEFAULT 100,
    `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `UserCheckinRecord_userId_checkinDate_key` ON `UserCheckinRecord`(`userId`, `checkinDate`);

-- CreateIndex
CREATE INDEX `UserCheckinRecord_checkinDate_idx` ON `UserCheckinRecord`(`checkinDate`);

-- CreateIndex
CREATE INDEX `UserCheckinRecord_userId_createdAt_idx` ON `UserCheckinRecord`(`userId`, `createdAt`);

-- AddForeignKey
ALTER TABLE `UserCheckinRecord` ADD CONSTRAINT `UserCheckinRecord_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
