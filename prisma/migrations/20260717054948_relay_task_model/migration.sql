-- CreateTable
CREATE TABLE "RelayTask" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "apiKeyId" TEXT,
    "requestId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'video',
    "model" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "input" JSONB,
    "output" JSONB,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "RelayTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RelayTask_requestId_key" ON "RelayTask"("requestId");

-- CreateIndex
CREATE INDEX "RelayTask_userId_createdAt_idx" ON "RelayTask"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "RelayTask_status_idx" ON "RelayTask"("status");

-- CreateIndex
CREATE INDEX "RelayTask_requestId_idx" ON "RelayTask"("requestId");

-- AddForeignKey
ALTER TABLE "RelayTask" ADD CONSTRAINT "RelayTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelayTask" ADD CONSTRAINT "RelayTask_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "APIKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;
