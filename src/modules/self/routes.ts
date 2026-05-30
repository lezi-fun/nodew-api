import type { Prisma } from '@prisma/client';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { hashPassword, verifyPassword } from '../../lib/crypto.js';
import { prisma } from '../../lib/prisma.js';
import {
  buildOtpAuthUri,
  generateBackupCodes,
  generateTotpSecret,
  isValidBackupCodeFormat,
  normalizeBackupCode,
  validateTotpCode,
} from '../../lib/totp.js';
import { updateUserPassword } from '../auth/password-reset.js';

const updateSelfBodySchema = z.object({
  displayName: z.string().min(1).max(64).optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
});

const changePasswordBodySchema = z.object({
  currentPassword: z.string().min(8).max(128),
  newPassword: z.string().min(8).max(128),
});

const twoFAEnableBodySchema = z.object({
  code: z.string().trim().min(1).max(32),
});

const twoFADisableBodySchema = z.object({
  code: z.string().trim().min(1).max(32),
});

const twoFARegenerateBackupCodesBodySchema = z.object({
  code: z.string().trim().min(1).max(32),
});

const selfSelect = {
  id: true,
  email: true,
  username: true,
  displayName: true,
  emailVerifiedAt: true,
  role: true,
  status: true,
  quotaRemaining: true,
  quotaUsed: true,
  lastLoginAt: true,
  settings: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

const serializeUser = (user: {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  emailVerifiedAt: Date | null;
  role: 'USER' | 'ADMIN';
  status: 'ACTIVE' | 'DISABLED';
  quotaRemaining: bigint;
  quotaUsed: bigint;
  lastLoginAt: Date | null;
  settings: Prisma.JsonValue | null;
  createdAt: Date;
}) => ({
  ...user,
  quotaRemaining: user.quotaRemaining.toString(),
  quotaUsed: user.quotaUsed.toString(),
});

const twoFASelect = {
  id: true,
  userId: true,
  secret: true,
  isEnabled: true,
  failedAttempts: true,
  lockedUntil: true,
  lastUsedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

const backupCodeSelect = {
  id: true,
  codeHash: true,
} as const;

const resolveTwoFAIssuer = async () => {
  const option = await prisma.systemOption.findUnique({
    where: { key: 'site_name' },
    select: { value: true },
  });

  return option?.value?.trim() || 'NodEW-api';
};

const getTwoFAStatus = async (userId: string) => {
  const twoFA = await prisma.twoFA.findUnique({
    where: { userId },
    select: twoFASelect,
  });

  if (!twoFA) {
    return {
      enabled: false,
      locked: false,
      backupCodesRemaining: 0,
    };
  }

  const backupCodesRemaining = await prisma.twoFABackupCode.count({
    where: {
      userId,
      isUsed: false,
    },
  });

  return {
    enabled: twoFA.isEnabled,
    locked: Boolean(twoFA.lockedUntil && twoFA.lockedUntil > new Date()),
    backupCodesRemaining,
  };
};

const setupTwoFA = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      username: true,
    },
  });

  if (!user) {
    throw new Error('User not found');
  }

  const issuer = await resolveTwoFAIssuer();
  const secret = generateTotpSecret();
  const backupCodes = generateBackupCodes();

  await prisma.$transaction(async (tx) => {
    const existing = await tx.twoFA.findUnique({
      where: { userId },
      select: {
        isEnabled: true,
      },
    });

    if (existing?.isEnabled) {
      throw new Error('Two-factor authentication is already enabled');
    }

    await tx.twoFABackupCode.deleteMany({
      where: { userId },
    });
    await tx.twoFA.deleteMany({
      where: { userId },
    });

    await tx.twoFA.create({
      data: {
        userId,
        secret,
        isEnabled: false,
      },
      select: twoFASelect,
    });

    await tx.twoFABackupCode.createMany({
      data: backupCodes.map((code) => ({
        userId,
        codeHash: hashPassword(normalizeBackupCode(code)),
      })),
    });
  });

  return {
    secret,
    qrCodeData: buildOtpAuthUri({
      secret,
      issuer,
      accountName: user.username,
    }),
    backupCodes,
  };
};

const enableTwoFA = async (userId: string, code: string) => {
  const twoFA = await prisma.twoFA.findUnique({
    where: { userId },
    select: twoFASelect,
  });

  if (!twoFA) {
    throw new Error('Two-factor authentication has not been initialized');
  }

  if (twoFA.isEnabled) {
    throw new Error('Two-factor authentication is already enabled');
  }

  if (!validateTotpCode(twoFA.secret, code, { window: 1 })) {
    throw new Error('Verification code is invalid');
  }

  await prisma.twoFA.update({
    where: { userId },
    data: {
      isEnabled: true,
      failedAttempts: 0,
      lockedUntil: null,
      lastUsedAt: new Date(),
    },
  });
};

const disableTwoFA = async (userId: string, code: string) => {
  const twoFA = await prisma.twoFA.findUnique({
    where: { userId },
    select: twoFASelect,
  });

  if (!twoFA || !twoFA.isEnabled) {
    throw new Error('Two-factor authentication is not enabled');
  }

  const totpValid = validateTotpCode(twoFA.secret, code, { window: 1 });

  if (!totpValid) {
    const normalizedBackupCode = normalizeBackupCode(code);

    if (!isValidBackupCodeFormat(normalizedBackupCode)) {
      throw new Error('Verification code or backup code is invalid');
    }

    const backupCodes = await prisma.twoFABackupCode.findMany({
      where: {
        userId,
        isUsed: false,
      },
      select: backupCodeSelect,
    });

    const matchedBackupCode = backupCodes.find((backupCode) => verifyPassword(normalizedBackupCode, backupCode.codeHash));

    if (!matchedBackupCode) {
      throw new Error('Verification code or backup code is invalid');
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.twoFABackupCode.deleteMany({
      where: { userId },
    });
    await tx.twoFA.deleteMany({
      where: { userId },
    });
  });
};

const regenerateTwoFABackupCodes = async (userId: string, code: string) => {
  const twoFA = await prisma.twoFA.findUnique({
    where: { userId },
    select: twoFASelect,
  });

  if (!twoFA || !twoFA.isEnabled) {
    throw new Error('Two-factor authentication is not enabled');
  }

  if (!validateTotpCode(twoFA.secret, code, { window: 1 })) {
    throw new Error('Verification code is invalid');
  }

  const backupCodes = generateBackupCodes();

  await prisma.$transaction(async (tx) => {
    await tx.twoFABackupCode.deleteMany({
      where: { userId },
    });

    await tx.twoFABackupCode.createMany({
      data: backupCodes.map((backupCode) => ({
        userId,
        codeHash: hashPassword(normalizeBackupCode(backupCode)),
      })),
    });
  });

  return {
    backupCodes,
  };
};

const selfRoutes: FastifyPluginAsync = async (app) => {
  app.get('/user/self', {
    preHandler: app.requireUser,
  }, async (request) => {
    const user = await prisma.user.findUnique({
      where: { id: request.currentUser!.id },
      select: selfSelect,
    });

    return {
      user: user ? serializeUser(user) : null,
    };
  });

  app.patch('/user/self', {
    preHandler: app.requireUser,
  }, async (request) => {
    const body = updateSelfBodySchema.parse(request.body);

    const updateData: Prisma.UserUpdateInput = {
      displayName: body.displayName,
    };

    if (body.settings !== undefined) {
      updateData.settings = body.settings as Prisma.InputJsonValue;
    }

    const user = await prisma.user.update({
      where: { id: request.currentUser!.id },
      data: updateData,
      select: selfSelect,
    });

    return {
      user: serializeUser(user),
    };
  });

  app.post('/user/self/password', {
    preHandler: app.requireUser,
  }, async (request) => {
    const body = changePasswordBodySchema.parse(request.body);

    if (body.currentPassword === body.newPassword) {
      throw app.httpErrors.badRequest('New password must be different from the current password');
    }

    const user = await prisma.user.findUnique({
      where: { id: request.currentUser!.id },
      select: {
        id: true,
        passwordHash: true,
      },
    });

    if (!user || !verifyPassword(body.currentPassword, user.passwordHash)) {
      throw app.httpErrors.unauthorized('Current password is incorrect');
    }

    await updateUserPassword({
      userId: user.id,
      password: body.newPassword,
    });

    return {
      success: true,
    };
  });

  app.get('/user/2fa/status', {
    preHandler: app.requireUser,
  }, async (request) => {
    const status = await getTwoFAStatus(request.currentUser!.id);

    return {
      item: status,
    };
  });

  app.post('/user/2fa/setup', {
    preHandler: app.requireUser,
  }, async (request) => {
    try {
      const setup = await setupTwoFA(request.currentUser!.id);

      return {
        item: setup,
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Two-factor authentication is already enabled') {
          throw app.httpErrors.conflict(error.message);
        }

        if (error.message === 'User not found') {
          throw app.httpErrors.notFound(error.message);
        }

        throw app.httpErrors.badRequest(error.message);
      }

      throw error;
    }
  });

  app.post('/user/2fa/enable', {
    preHandler: app.requireUser,
  }, async (request) => {
    const body = twoFAEnableBodySchema.parse(request.body);

    try {
      await enableTwoFA(request.currentUser!.id, body.code);
    } catch (error) {
      if (error instanceof Error) {
        throw app.httpErrors.badRequest(error.message);
      }

      throw error;
    }

    return {
      success: true,
    };
  });

  app.post('/user/2fa/disable', {
    preHandler: app.requireUser,
  }, async (request) => {
    const body = twoFADisableBodySchema.parse(request.body);

    try {
      await disableTwoFA(request.currentUser!.id, body.code);
    } catch (error) {
      if (error instanceof Error) {
        throw app.httpErrors.badRequest(error.message);
      }

      throw error;
    }

    return {
      success: true,
    };
  });

  app.post('/user/2fa/backup-codes', {
    preHandler: app.requireUser,
  }, async (request) => {
    const body = twoFARegenerateBackupCodesBodySchema.parse(request.body);

    try {
      const result = await regenerateTwoFABackupCodes(request.currentUser!.id, body.code);

      return {
        item: result,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw app.httpErrors.badRequest(error.message);
      }

      throw error;
    }
  });
};

export default selfRoutes;
