ALTER TYPE "TopUpOrderProvider" ADD VALUE 'CREEM';

ALTER TABLE "TopUpOrder"
    ADD COLUMN "creemCheckoutId" VARCHAR(255),
    ADD COLUMN "creemRequestId" VARCHAR(255),
    ADD COLUMN "creemOrderId" VARCHAR(255),
    ADD COLUMN "creemProductId" VARCHAR(255);

CREATE UNIQUE INDEX "TopUpOrder_creemCheckoutId_key" ON "TopUpOrder"("creemCheckoutId");
CREATE UNIQUE INDEX "TopUpOrder_creemRequestId_key" ON "TopUpOrder"("creemRequestId");
CREATE UNIQUE INDEX "TopUpOrder_creemOrderId_key" ON "TopUpOrder"("creemOrderId");
CREATE INDEX "TopUpOrder_creemProductId_idx" ON "TopUpOrder"("creemProductId");
