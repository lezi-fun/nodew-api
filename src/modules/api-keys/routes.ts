import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { generateApiKey, getApiKeyPrefix, hashApiKey, maskApiKey } from '../../lib/crypto.js';
import { prisma } from '../../lib/prisma.js';

const createApiKeyBodySchema = z.object({
  name: z.string().min(1).max(64),
  expiresAt: z.string().datetime().optional(),
  quotaRemaining: z.coerce.bigint().optional(),
});

const updateApiKeyBodySchema = z.object({
  name: z.string().min(1).max(64).optional(),
  status: z.enum(['ACTIVE', 'REVOKED']).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  quotaRemaining: z.coerce.bigint().nullable().optional(),
});

const apiKeyRoutes: FastifyPluginAsync = async (app) => {
  app.get('/token', {
    preHandler: app.requireUser,
  }, async (request) => {
    const apiKeys = await prisma.aPIKey.findMany({
      where: { userId: request.currentUser!.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        status: true,
        quotaRemaining: true,
        lastUsedAt: true,
        expiresAt: true,
        revokedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      items: apiKeys.map((apiKey) => ({
        ...apiKey,
        quotaRemaining: apiKey.quotaRemaining?.toString() ?? null,
        maskedKey: maskApiKey(apiKey.keyPrefix),
      })),
    };
  });

  app.post('/token', {
    preHandler: app.requireUser,
  }, async (request, reply) => {
    const body = createApiKeyBodySchema.parse(request.body);
    const plaintextKey = generateApiKey();

    const apiKey = await prisma.aPIKey.create({
      data: {
        userId: request.currentUser!.id,
        createdById: request.currentUser!.id,
        name: body.name,
        keyHash: hashApiKey(plaintextKey),
        keyPrefix: getApiKeyPrefix(plaintextKey),
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
        quotaRemaining: body.quotaRemaining,
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        status: true,
        quotaRemaining: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    return reply.code(201).send({
      item: {
        ...apiKey,
        quotaRemaining: apiKey.quotaRemaining?.toString() ?? null,
        key: plaintextKey,
        maskedKey: maskApiKey(apiKey.keyPrefix),
      },
    });
  });

  app.put('/token/:id', {
    preHandler: app.requireUser,
  }, async (request) => {
    const params = z.object({ id: z.string().cuid() }).parse(request.params);
    const body = updateApiKeyBodySchema.parse(request.body);

    const existing = await prisma.aPIKey.findFirst({
      where: {
        id: params.id,
        userId: request.currentUser!.id,
      },
      select: { id: true },
    });

    if (!existing) {
      throw app.httpErrors.notFound('API key not found');
    }

    const apiKey = await prisma.aPIKey.update({
      where: { id: params.id },
      data: {
        name: body.name,
        status: body.status,
        expiresAt: body.expiresAt === null ? null : body.expiresAt ? new Date(body.expiresAt) : undefined,
        quotaRemaining: body.quotaRemaining,
        revokedAt: body.status === 'REVOKED' ? new Date() : body.status === 'ACTIVE' ? null : undefined,
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        status: true,
        quotaRemaining: true,
        lastUsedAt: true,
        expiresAt: true,
        revokedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      item: {
        ...apiKey,
        quotaRemaining: apiKey.quotaRemaining?.toString() ?? null,
        maskedKey: maskApiKey(apiKey.keyPrefix),
      },
    };
  });

  app.delete('/token/:id', {
    preHandler: app.requireUser,
  }, async (request) => {
    const params = z.object({ id: z.string().cuid() }).parse(request.params);

    const deleted = await prisma.aPIKey.deleteMany({
      where: {
        id: params.id,
        userId: request.currentUser!.id,
      },
    });

    if (deleted.count === 0) {
      throw app.httpErrors.notFound('API key not found');
    }

    return {
      success: true,
    };
  });

  app.post('/token/:id/key', {
    preHandler: app.requireUser,
  }, async (request) => {
    const params = z.object({ id: z.string().cuid() }).parse(request.params);

    const apiKey = await prisma.aPIKey.findFirst({
      where: {
        id: params.id,
        userId: request.currentUser!.id,
      },
      select: {
        id: true,
        keyPrefix: true,
      },
    });

    if (!apiKey) {
      throw app.httpErrors.notFound('API key not found');
    }

    return {
      item: {
        id: apiKey.id,
        keyPrefix: apiKey.keyPrefix,
        maskedKey: maskApiKey(apiKey.keyPrefix),
        note: 'Plaintext keys are only returned when the key is created.',
      },
    };
  });
};

export default apiKeyRoutes;
