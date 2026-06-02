CREATE TABLE "UserOAuthBinding" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" VARCHAR(64) NOT NULL,
    "providerUserId" VARCHAR(191) NOT NULL,
    "email" VARCHAR(255),
    "displayName" VARCHAR(255),
    "avatarUrl" TEXT,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "scope" TEXT,
    "tokenType" VARCHAR(64),
    "expiresAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "UserOAuthBinding_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserOAuthBinding_provider_providerUserId_key" ON "UserOAuthBinding"("provider", "providerUserId");
CREATE UNIQUE INDEX "UserOAuthBinding_userId_provider_key" ON "UserOAuthBinding"("userId", "provider");
CREATE INDEX "UserOAuthBinding_userId_idx" ON "UserOAuthBinding"("userId");
CREATE INDEX "UserOAuthBinding_provider_idx" ON "UserOAuthBinding"("provider");
CREATE INDEX "UserOAuthBinding_deletedAt_idx" ON "UserOAuthBinding"("deletedAt");

ALTER TABLE "UserOAuthBinding" ADD CONSTRAINT "UserOAuthBinding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
