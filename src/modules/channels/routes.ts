import { Prisma } from '@prisma/client';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import {
  encryptChannelKey,
  hasEncryptedValue,
  readChannelKeyPreview,
} from '../../lib/crypto.js';
import { prisma } from '../../lib/prisma.js';

const channelSelect = {
  id: true,
  name: true,
  provider: true,
  baseUrl: true,
  model: true,
  status: true,
  priority: true,
  weight: true,
  rateLimitPerMin: true,
  metadata: true,
  encryptedKey: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ChannelSelect;

const channelParamsSchema = z.object({
  id: z.string().cuid(),
});

const channelBodySchema = z.object({
  name: z.string().min(1).max(64),
  provider: z.string().min(1).max(32),
  baseUrl: z.string().url().max(2048).optional().nullable(),
  model: z.string().min(1).max(128).optional().nullable(),
  apiKey: z.string().min(1).max(2048),
  status: z.enum(['ACTIVE', 'DISABLED']).default('ACTIVE'),
  priority: z.coerce.number().int().min(0).max(1000).default(0),
  weight: z.coerce.number().int().min(1).max(1000).default(1),
  rateLimitPerMin: z.coerce.number().int().min(1).max(1_000_000).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const updateChannelBodySchema = z.object({
  name: z.string().min(1).max(64).optional(),
  provider: z.string().min(1).max(32).optional(),
  baseUrl: z.string().url().max(2048).nullable().optional(),
  model: z.string().min(1).max(128).nullable().optional(),
  apiKey: z.string().min(1).max(2048).optional(),
  status: z.enum(['ACTIVE', 'DISABLED']).optional(),
  priority: z.coerce.number().int().min(0).max(1000).optional(),
  weight: z.coerce.number().int().min(1).max(1000).optional(),
  rateLimitPerMin: z.coerce.number().int().min(1).max(1_000_000).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
});

const serializeChannel = (channel: {
  id: string;
  name: string;
  provider: string;
  baseUrl: string | null;
  model: string | null;
  status: 'ACTIVE' | 'DISABLED';
  priority: number;
  weight: number;
  rateLimitPerMin: number | null;
  metadata: Prisma.JsonValue | null;
  encryptedKey: string;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: channel.id,
  name: channel.name,
  provider: channel.provider,
  baseUrl: channel.baseUrl,
  model: channel.model,
  status: channel.status,
  priority: channel.priority,
  weight: channel.weight,
  rateLimitPerMin: channel.rateLimitPerMin,
  metadata: channel.metadata,
  keyPreview: readChannelKeyPreview(channel.encryptedKey),
  createdAt: channel.createdAt,
  updatedAt: channel.updatedAt,
});

const channelRoutes: FastifyPluginAsync = async (app) => {
  app.get('/channels', {
    preHandler: app.requireUser,
  }, async () => {
    const channels = await prisma.channel.findMany({
      orderBy: [{ priority: 'desc' }, { weight: 'desc' }, { createdAt: 'desc' }],
      select: channelSelect,
    });

    return {
      items: channels.map(serializeChannel),
    };
  });

  app.post('/channels', {
    preHandler: app.requireUser,
  }, async (request, reply) => {
    const body = channelBodySchema.parse(request.body);

    const channel = await prisma.channel.create({
      data: {
        name: body.name,
        provider: body.provider,
        baseUrl: body.baseUrl ?? null,
        model: body.model ?? null,
        encryptedKey: encryptChannelKey(body.apiKey),
        status: body.status,
        priority: body.priority,
        weight: body.weight,
        rateLimitPerMin: body.rateLimitPerMin ?? null,
        metadata: body.metadata as Prisma.InputJsonValue | undefined,
      },
      select: channelSelect,
    });

    return reply.code(201).send({
      item: serializeChannel(channel),
    });
  });

  app.patch('/channels/:id', {
    preHandler: app.requireUser,
  }, async (request) => {
    const params = channelParamsSchema.parse(request.params);
    const body = updateChannelBodySchema.parse(request.body);

    const existing = await prisma.channel.findUnique({
      where: { id: params.id },
      select: { id: true },
    });

    if (!existing) {
      throw app.httpErrors.notFound('Channel not found');
    }

    const updateData: Prisma.ChannelUpdateInput = {};

    if (body.name !== undefined) {
      updateData.name = body.name;
    }

    if (body.provider !== undefined) {
      updateData.provider = body.provider;
    }

    if (body.baseUrl !== undefined) {
      updateData.baseUrl = body.baseUrl;
    }

    if (body.model !== undefined) {
      updateData.model = body.model;
    }

    if (body.apiKey !== undefined) {
      updateData.encryptedKey = hasEncryptedValue(body.apiKey) ? body.apiKey : encryptChannelKey(body.apiKey);
    }

    if (body.status !== undefined) {
      updateData.status = body.status;
    }

    if (body.priority !== undefined) {
      updateData.priority = body.priority;
    }

    if (body.weight !== undefined) {
      updateData.weight = body.weight;
    }

    if (body.rateLimitPerMin !== undefined) {
      updateData.rateLimitPerMin = body.rateLimitPerMin;
    }

    if (body.metadata !== undefined) {
      updateData.metadata = body.metadata === null ? Prisma.JsonNull : (body.metadata as Prisma.InputJsonValue);
    }

    const channel = await prisma.channel.update({
      where: { id: params.id },
      data: updateData,
      select: channelSelect,
    });

    return {
      item: serializeChannel(channel),
    };
  });

  app.delete('/channels/:id', {
    preHandler: app.requireUser,
  }, async (request) => {
    const params = channelParamsSchema.parse(request.params);

    const deleted = await prisma.channel.deleteMany({
      where: { id: params.id },
    });

    if (deleted.count === 0) {
      throw app.httpErrors.notFound('Channel not found');
    }

    return {
      success: true,
    };
  });
};

export default channelRoutes;
