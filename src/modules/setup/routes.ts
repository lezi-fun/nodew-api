import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { generateAccessToken, hashPassword } from '../../lib/crypto.js';
import { prisma } from '../../lib/prisma.js';
import { setSessionCookie } from '../../plugins/auth.js';

const setupBodySchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_-]+$/),
  password: z.string().min(8).max(128),
  displayName: z.string().min(1).max(64).optional(),
});

const setupRoutes: FastifyPluginAsync = async (app) => {
  app.get('/setup', async () => {
    const setupState = await prisma.setupState.findFirst();
    const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });

    return {
      isInitialized: setupState?.isInitialized ?? false,
      hasAdmin: adminCount > 0,
    };
  });

  app.post('/setup', async (request, reply) => {
    const body = setupBodySchema.parse(request.body);
    const setupState = await prisma.setupState.findFirst();

    if (setupState?.isInitialized) {
      return reply.conflict('System already initialized');
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email: body.email }, { username: body.username }],
      },
      select: { id: true },
    });

    if (existingUser) {
      return reply.conflict('User already exists');
    }

    const sessionToken = generateAccessToken();

    const adminUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: body.email,
          username: body.username,
          passwordHash: hashPassword(body.password),
          displayName: body.displayName,
          role: 'ADMIN',
          accessToken: sessionToken,
        },
        select: {
          id: true,
          email: true,
          username: true,
          displayName: true,
          role: true,
          status: true,
          createdAt: true,
        },
      });

      if (setupState) {
        await tx.setupState.update({
          where: { id: setupState.id },
          data: {
            isInitialized: true,
            initializedAt: new Date(),
          },
        });
      } else {
        await tx.setupState.create({
          data: {
            isInitialized: true,
            initializedAt: new Date(),
          },
        });
      }

      await tx.systemOption.upsert({
        where: { key: 'registration_enabled' },
        update: { value: 'false' },
        create: { key: 'registration_enabled', value: 'false' },
      });

      return user;
    });

    setSessionCookie(reply, sessionToken);

    return reply.code(201).send({
      user: adminUser,
      isInitialized: true,
    });
  });
};

export default setupRoutes;
