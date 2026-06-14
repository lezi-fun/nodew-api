ALTER TABLE `TopUpOrder`
    MODIFY `provider` ENUM('STRIPE', 'CREEM', 'WAFFO') NOT NULL DEFAULT 'STRIPE',
    ADD COLUMN `waffoCheckoutId` VARCHAR(255) NULL,
    ADD COLUMN `waffoOrderId` VARCHAR(255) NULL,
    ADD COLUMN `waffoProductId` VARCHAR(255) NULL;

CREATE UNIQUE INDEX `TopUpOrder_waffoCheckoutId_key` ON `TopUpOrder`(`waffoCheckoutId`);
CREATE UNIQUE INDEX `TopUpOrder_waffoOrderId_key` ON `TopUpOrder`(`waffoOrderId`);
CREATE INDEX `TopUpOrder_waffoProductId_idx` ON `TopUpOrder`(`waffoProductId`);
