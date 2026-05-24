import {
  generateEmailVerificationToken,
  generateVerificationCode,
  hashEmailVerificationToken,
  hashPassword,
  hashVerificationCode,
  verifyEmailVerificationToken,
  verifyVerificationCode,
} from '../../lib/crypto.js';
import { prisma } from '../../lib/prisma.js';

export const pendingRegistrationTtlMs = 1000 * 60 * 30;

type PendingRegistrationInput = {
  email: string;
  username: string;
  password: string;
  displayName?: string;
};

type PendingRegistrationRecord = {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  displayName: string | null;
  verificationTokenHash: string;
  verificationCodeHash: string;
  verificationExpiresAt: Date;
  verificationRequestedAt: Date;
};

export const createPendingRegistration = async (input: PendingRegistrationInput, now = new Date()) => {
  const token = generateEmailVerificationToken();
  const code = generateVerificationCode();
  const expiresAt = new Date(now.getTime() + pendingRegistrationTtlMs);

  const record = await prisma.pendingUserRegistration.upsert({
    where: { email: input.email },
    update: {
      username: input.username,
      passwordHash: hashPassword(input.password),
      displayName: input.displayName ?? input.username,
      verificationTokenHash: hashEmailVerificationToken(token),
      verificationCodeHash: hashVerificationCode(code),
      verificationExpiresAt: expiresAt,
      verificationRequestedAt: now,
    },
    create: {
      email: input.email,
      username: input.username,
      passwordHash: hashPassword(input.password),
      displayName: input.displayName ?? input.username,
      verificationTokenHash: hashEmailVerificationToken(token),
      verificationCodeHash: hashVerificationCode(code),
      verificationExpiresAt: expiresAt,
      verificationRequestedAt: now,
    },
    select: {
      id: true,
      email: true,
      username: true,
      passwordHash: true,
      displayName: true,
      verificationTokenHash: true,
      verificationCodeHash: true,
      verificationExpiresAt: true,
      verificationRequestedAt: true,
    },
  });

  return {
    record,
    token,
    code,
  };
};

export const getPendingRegistrationByToken = async (token: string) => prisma.pendingUserRegistration.findUnique({
  where: {
    verificationTokenHash: hashEmailVerificationToken(token),
  },
  select: {
    id: true,
    email: true,
    username: true,
    passwordHash: true,
    displayName: true,
    verificationTokenHash: true,
    verificationCodeHash: true,
    verificationExpiresAt: true,
    verificationRequestedAt: true,
  },
});

export const getPendingRegistrationByEmail = async (email: string) => prisma.pendingUserRegistration.findUnique({
  where: { email },
  select: {
    id: true,
    email: true,
    username: true,
    passwordHash: true,
    displayName: true,
    verificationTokenHash: true,
    verificationCodeHash: true,
    verificationExpiresAt: true,
    verificationRequestedAt: true,
  },
});

export const canUsePendingRegistration = (
  pendingRegistration: PendingRegistrationRecord | null,
  verifier: { token?: string; code?: string },
  now = new Date(),
) => {
  if (!pendingRegistration || pendingRegistration.verificationExpiresAt <= now) {
    return false;
  }

  if (verifier.token) {
    return verifyEmailVerificationToken(verifier.token, pendingRegistration.verificationTokenHash);
  }

  if (verifier.code) {
    return verifyVerificationCode(verifier.code, pendingRegistration.verificationCodeHash);
  }

  return false;
};

export const deletePendingRegistration = async (id: string) => {
  await prisma.pendingUserRegistration.delete({
    where: { id },
  });
};

export const deleteExpiredPendingRegistrations = async (now = new Date()) => {
  await prisma.pendingUserRegistration.deleteMany({
    where: {
      verificationExpiresAt: {
        lte: now,
      },
    },
  });
};
