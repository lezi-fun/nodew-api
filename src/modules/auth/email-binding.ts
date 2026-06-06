import {
  generateEmailVerificationToken,
  generateVerificationCode,
  hashEmailVerificationToken,
  hashVerificationCode,
  verifyEmailVerificationToken,
  verifyVerificationCode,
} from '../../lib/crypto.js';
import { prisma } from '../../lib/prisma.js';

export const pendingEmailBindingTtlMs = 1000 * 60 * 30;

type PendingEmailBindingRecord = {
  pendingEmail: string | null;
  pendingEmailVerificationTokenHash: string | null;
  pendingEmailVerificationCodeHash: string | null;
  pendingEmailVerificationExpiresAt: Date | null;
};

export const createPendingEmailBinding = async (userId: string, email: string, now = new Date()) => {
  const token = generateEmailVerificationToken();
  const code = generateVerificationCode();
  const expiresAt = new Date(now.getTime() + pendingEmailBindingTtlMs);

  await prisma.user.update({
    where: { id: userId },
    data: {
      pendingEmail: email,
      pendingEmailVerificationTokenHash: hashEmailVerificationToken(token),
      pendingEmailVerificationCodeHash: hashVerificationCode(code),
      pendingEmailVerificationExpiresAt: expiresAt,
      pendingEmailVerificationRequestedAt: now,
    },
  });

  return {
    token,
    code,
  };
};

export const clearPendingEmailBinding = async (userId: string) => prisma.user.update({
  where: { id: userId },
  data: {
    pendingEmail: null,
    pendingEmailVerificationTokenHash: null,
    pendingEmailVerificationCodeHash: null,
    pendingEmailVerificationExpiresAt: null,
    pendingEmailVerificationRequestedAt: null,
  },
});

export const canUsePendingEmailBinding = (
  binding: PendingEmailBindingRecord | null,
  verifier: { token?: string; code?: string },
  now = new Date(),
) => {
  if (!binding?.pendingEmail || !binding.pendingEmailVerificationExpiresAt || binding.pendingEmailVerificationExpiresAt <= now) {
    return false;
  }

  if (verifier.token && binding.pendingEmailVerificationTokenHash) {
    return verifyEmailVerificationToken(verifier.token, binding.pendingEmailVerificationTokenHash);
  }

  if (verifier.code && binding.pendingEmailVerificationCodeHash) {
    return verifyVerificationCode(verifier.code, binding.pendingEmailVerificationCodeHash);
  }

  return false;
};
