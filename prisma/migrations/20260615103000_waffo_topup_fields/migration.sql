ALTER TYPE "TopUpOrderProvider" ADD VALUE 'WAFFO';

ALTER TABLE "TopUpOrder"
    ADD COLUMN "waffoCheckoutId" VARCHAR(255),
    ADD COLUMN "waffoOrderId" VARCHAR(255),
    ADD COLUMN "waffoProductId" VARCHAR(255);

CREATE UNIQUE INDEX "TopUpOrder_waffoCheckoutId_key" ON "TopUpOrder"("waffoCheckoutId");
CREATE UNIQUE INDEX "TopUpOrder_waffoOrderId_key" ON "TopUpOrder"("waffoOrderId");
CREATE INDEX "TopUpOrder_waffoProductId_idx" ON "TopUpOrder"("waffoProductId");
