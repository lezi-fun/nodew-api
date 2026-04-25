import { RedemptionStatus } from '@prisma/client';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import {
  generateRedemptionCode,
  getRedemptionCodePrefix,
  hashRedemptionCode,
  maskRedemptionCode,
} from '../../../../src/lib/crypto.js';
import { prisma } from '../../../../src/lib/prisma.js';

const redemptionStatusSchema = z.enum(['ACTIVE', 'REDEEMED', 'REVOKED']);

const createRedemptionBodySchema = z.object({
  quotaAmount: z.coerce.bigint().positive(),
  expiresAt: z.string().datetime().optional(),
});

const updateRedemptionBodySchema = z.object({
  quotaAmount: z.coerce.bigint().positive().optional(),
  status: redemptionStatusSchema.optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

const redemptionParamsSchema = z.object({
  id: z.string().cuid(),
});

const redemptionQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().cuid().optional(),
  status: redemptionStatusSchema.optional(),
});

const redemptionSelect = {
  id: true,
  codePrefix: true,
  quotaAmount: true,
  status: true,
  expiresAt: true,
  redeemedAt: true,
  createdAt: true,
  updatedAt: true,
  createdBy: {
    select: {
      id: true,
      email: true,
      username: true,
    },
  },
  redeemedByUser: {
    select: {
      id: true,
      email: true,
      username: true,
    },
  },
} as const;

const serializeRedemption = (redemption: {
  id: string;
  codePrefix: string;
  quotaAmount: bigint;
  status: RedemptionStatus;
  expiresAt: Date | null;
  redeemedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: { id: string; email: string; username: string };
  redeemedByUser: { id: string; email: string; username: string } | null;
}) => ({
  ...redemption,
  quotaAmount: redemption.quotaAmount.toString(),
  maskedCode: maskRedemptionCode(redemption.codePrefix),
});

const redemptionsRoutes: FastifyPluginAsync = async (app) => {
  app.post('/redemptions', {
    preHandler: app.requireAdminUser,
  }, async (request, reply) => {
    const body = createRedemptionBodySchema.parse(request.body);
    const code = generateRedemptionCode();

    const redemption = await prisma.redemption.create({
      data: {
        codeHash: hashRedemptionCode(code),
        codePrefix: getRedemptionCodePrefix(code),
        quotaAmount: body.quotaAmount,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
        createdById: request.currentUser!.id,
      },
      select: redemptionSelect,
    });

    return reply.code(201).send({
      item: {
        ...serializeRedemption(redemption),
        code,
      },
    });
  });

  app.get('/redemptions', {
    preHandler: app.requireAdminUser,
  }, async (request) => {
    const query = redemptionQuerySchema.parse(request.query);

    const redemptions = await prisma.redemption.findMany({
      where: query.status ? { status: query.status } : undefined,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      select: redemptionSelect,
    });

    const hasMore = redemptions.length > query.limit;
    const items = hasMore ? redemptions.slice(0, query.limit) : redemptions;

    return {
      items: items.map(serializeRedemption),
      nextCursor: hasMore ? items.at(-1)?.id ?? null : null,
    };
  });

  app.get('/redemptions/:id', {
    preHandler: app.requireAdminUser,
  }, async (request) => {
    const params = redemptionParamsSchema.parse(request.params);

    const redemption = await prisma.redemption.findUnique({
      where: { id: params.id },
      select: redemptionSelect,
    });

    if (!redemption) {
      throw app.httpErrors.notFound('Redemption not found');
    }

    return {
      item: serializeRedemption(redemption),
    };
  });

  app.patch('/redemptions/:id', {
    preHandler: app.requireAdminUser,
  }, async (request) => {
    const params = redemptionParamsSchema.parse(request.params);
    const body = updateRedemptionBodySchema.parse(request.body);

    const existing = await prisma.redemption.findUnique({
      where: { id: params.id },
      select: { id: true },
    });

    if (!existing) {
      throw app.httpErrors.notFound('Redemption not found');
    }

    const redemption = await prisma.redemption.update({
      where: { id: params.id },
      data: {
        quotaAmount: body.quotaAmount,
        status: body.status,
        expiresAt: body.expiresAt === null ? null : body.expiresAt ? new Date(body.expiresAt) : undefined,
      },
      select: redemptionSelect,
    });

    return {
      item: serializeRedemption(redemption),
    };
  });

  app.delete('/redemptions/:id', {
    preHandler: app.requireAdminUser,
  }, async (request) => {
    const params = redemptionParamsSchema.parse(request.params);

    const deleted = await prisma.redemption.deleteMany({
      where: { id: params.id },
    });

    if (deleted.count === 0) {
      throw app.httpErrors.notFound('Redemption not found');
    }

    return {
      success: true,
    };
  });
};

export default redemptionsRoutes;
