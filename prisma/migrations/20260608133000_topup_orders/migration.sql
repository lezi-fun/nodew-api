CREATE TYPE "TopUpOrderProvider" AS ENUM ('STRIPE');
CREATE TYPE "TopUpOrderStatus" AS ENUM ('PENDING', 'PAID', 'CANCELED', 'EXPIRED', 'FAILED');

CREATE TABLE "TopUpOrder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "TopUpOrderProvider" NOT NULL DEFAULT 'STRIPE',
    "status" "TopUpOrderStatus" NOT NULL DEFAULT 'PENDING',
    "quotaAmount" BIGINT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" VARCHAR(16) NOT NULL,
    "stripeSessionId" VARCHAR(255),
    "stripePaymentIntentId" VARCHAR(255),
    "metadata" JSONB,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TopUpOrder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TopUpOrder_stripeSessionId_key" ON "TopUpOrder"("stripeSessionId");
CREATE UNIQUE INDEX "TopUpOrder_stripePaymentIntentId_key" ON "TopUpOrder"("stripePaymentIntentId");
CREATE INDEX "TopUpOrder_userId_idx" ON "TopUpOrder"("userId");
CREATE INDEX "TopUpOrder_provider_idx" ON "TopUpOrder"("provider");
CREATE INDEX "TopUpOrder_status_idx" ON "TopUpOrder"("status");
CREATE INDEX "TopUpOrder_createdAt_idx" ON "TopUpOrder"("createdAt");

ALTER TABLE "TopUpOrder" ADD CONSTRAINT "TopUpOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
