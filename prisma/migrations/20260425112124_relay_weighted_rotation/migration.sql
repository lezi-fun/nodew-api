-- CreateTable
CREATE TABLE "RelaySelectionState" (
    "key" TEXT NOT NULL,
    "cursor" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RelaySelectionState_pkey" PRIMARY KEY ("key")
);
