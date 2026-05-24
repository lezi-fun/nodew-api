CREATE TABLE "PendingUserRegistration" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT,
    "verificationTokenHash" TEXT NOT NULL,
    "verificationCodeHash" TEXT NOT NULL,
    "verificationExpiresAt" TIMESTAMP(3) NOT NULL,
    "verificationRequestedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PendingUserRegistration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PendingUserRegistration_email_key" ON "PendingUserRegistration"("email");
CREATE UNIQUE INDEX "PendingUserRegistration_verificationTokenHash_key" ON "PendingUserRegistration"("verificationTokenHash");
CREATE INDEX "PendingUserRegistration_username_idx" ON "PendingUserRegistration"("username");
CREATE INDEX "PendingUserRegistration_verificationExpiresAt_idx" ON "PendingUserRegistration"("verificationExpiresAt");
