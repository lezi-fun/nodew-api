import type { Prisma } from '@prisma/client';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { verifyPassword } from '../../lib/crypto.js';
import { prisma } from '../../lib/prisma.js';
import { updateUserPassword } from '../auth/password-reset.js';

const updateSelfBodySchema = z.object({
  displayName: z.string().min(1).max(64).optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
});

const changePasswordBodySchema = z.object({
  currentPassword: z.string().min(8).max(128),
  newPassword: z.string().min(8).max(128),
});

const selfSelect = {
  id: true,
  email: true,
  username: true,
  displayName: true,
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
};

export default selfRoutes;
