import { hashPassword, hashPasswordResetToken, verifyPasswordResetToken } from '../../lib/crypto.js';
import { prisma } from '../../lib/prisma.js';

export const passwordResetTokenTtlMs = 1000 * 60 * 30;

export const setPasswordResetToken = async (userId: string, token: string, now = new Date()) => prisma.user.update({
  where: { id: userId },
  data: {
    passwordResetTokenHash: hashPasswordResetToken(token),
    passwordResetTokenExpiresAt: new Date(now.getTime() + passwordResetTokenTtlMs),
    passwordResetRequestedAt: now,
  },
});

export const clearPasswordResetToken = async (userId: string) => prisma.user.update({
  where: { id: userId },
  data: {
    passwordResetTokenHash: null,
    passwordResetTokenExpiresAt: null,
    passwordResetRequestedAt: null,
  },
});

export const updateUserPassword = async (params: {
  userId: string;
  password: string;
  revokeSession?: boolean;
}) => prisma.user.update({
  where: { id: params.userId },
  data: {
    passwordHash: hashPassword(params.password),
    accessToken: params.revokeSession === false ? undefined : null,
    passwordResetTokenHash: null,
    passwordResetTokenExpiresAt: null,
    passwordResetRequestedAt: null,
  },
});

export const canUsePasswordResetToken = (user: {
  passwordResetTokenHash: string | null;
  passwordResetTokenExpiresAt: Date | null;
}, token: string, now = new Date()) => {
  if (!user.passwordResetTokenHash || !user.passwordResetTokenExpiresAt) {
    return false;
  }

  if (user.passwordResetTokenExpiresAt <= now) {
    return false;
  }

  return verifyPasswordResetToken(token, user.passwordResetTokenHash);
};
