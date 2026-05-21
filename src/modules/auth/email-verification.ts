import { hashEmailVerificationToken, verifyEmailVerificationToken } from '../../lib/crypto.js';
import { prisma } from '../../lib/prisma.js';

export const emailVerificationTokenTtlMs = 1000 * 60 * 30;

export const setEmailVerificationToken = async (userId: string, token: string, now = new Date()) => prisma.user.update({
  where: { id: userId },
  data: {
    emailVerificationTokenHash: hashEmailVerificationToken(token),
    emailVerificationTokenExpiresAt: new Date(now.getTime() + emailVerificationTokenTtlMs),
    emailVerificationRequestedAt: now,
  },
});

export const clearEmailVerificationToken = async (userId: string) => prisma.user.update({
  where: { id: userId },
  data: {
    emailVerificationTokenHash: null,
    emailVerificationTokenExpiresAt: null,
    emailVerificationRequestedAt: null,
  },
});

export const canUseEmailVerificationToken = (user: {
  emailVerificationTokenHash: string | null;
  emailVerificationTokenExpiresAt: Date | null;
}, token: string, now = new Date()) => {
  if (!user.emailVerificationTokenHash || !user.emailVerificationTokenExpiresAt) {
    return false;
  }

  if (user.emailVerificationTokenExpiresAt <= now) {
    return false;
  }

  return verifyEmailVerificationToken(token, user.emailVerificationTokenHash);
};
