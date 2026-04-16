import type { Prisma } from '@prisma/client';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { prisma } from '../../lib/prisma.js';

const updateSelfBodySchema = z.object({
  displayName: z.string().min(1).max(64).optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
});

const selfRoutes: FastifyPluginAsync = async (app) => {
  app.get('/user/self', {
    preHandler: app.requireUser,
  }, async (request) => {
    const user = await prisma.user.findUnique({
      where: { id: request.currentUser!.id },
      select: {
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
      },
    });

    return {
      user: user
        ? {
            ...user,
            quotaRemaining: user.quotaRemaining.toString(),
            quotaUsed: user.quotaUsed.toString(),
          }
        : null,
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
      select: {
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
      },
    });

    return {
      user: {
        ...user,
        quotaRemaining: user.quotaRemaining.toString(),
        quotaUsed: user.quotaUsed.toString(),
      },
    };
  });
};

export default selfRoutes;
