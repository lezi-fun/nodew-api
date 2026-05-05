import { Prisma } from '@prisma/client';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import {
  encryptChannelKey,
  generateRedemptionCode,
  getRedemptionCodePrefix,
  hashRedemptionCode,
  maskApiKey,
  maskRedemptionCode,
  readChannelKeyPreview,
} from '../../lib/crypto.js';
import { prisma } from '../../lib/prisma.js';
import { getChannelSupportedModels } from '../relay/model-routing.js';

const idParamsSchema = z.object({
  id: z.string().min(1),
});

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  page: z.coerce.number().int().min(1).default(1),
  cursor: z.string().optional(),
  keyword: z.string().trim().min(1).max(128).optional(),
});

const channelBodySchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(64),
  provider: z.string().min(1).max(32).default('openai'),
  baseUrl: z.string().url().max(2048).optional().nullable(),
  model: z.string().min(1).max(128).optional().nullable(),
  apiKey: z.string().min(1).max(2048).optional(),
  key: z.string().min(1).max(2048).optional(),
  status: z.enum(['ACTIVE', 'DISABLED']).default('ACTIVE'),
  priority: z.coerce.number().int().min(0).max(1000).default(0),
  weight: z.coerce.number().int().min(1).max(1000).default(1),
  rateLimitPerMin: z.coerce.number().int().min(1).max(1_000_000).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

const updateChannelBodySchema = channelBodySchema.partial().extend({
  id: z.string().min(1),
});

const tokenBodySchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(64),
  expiresAt: z.string().datetime().optional().nullable(),
  quotaRemaining: z.coerce.bigint().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
  status: z.enum(['ACTIVE', 'REVOKED']).optional(),
});

const updateTokenBodySchema = tokenBodySchema.partial().extend({
  id: z.string().min(1),
});

const batchIdsBodySchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(100),
});

const redemptionBodySchema = z.object({
  id: z.string().optional(),
  quotaAmount: z.coerce.bigint().positive(),
  expiresAt: z.string().datetime().optional().nullable(),
  status: z.enum(['ACTIVE', 'REDEEMED', 'REVOKED']).optional(),
});

const updateRedemptionBodySchema = redemptionBodySchema.partial().extend({
  id: z.string().min(1),
});

const ok = <T>(data: T, extra: Record<string, unknown> = {}) => ({
  success: true,
  message: '',
  data,
  ...extra,
});

const paginate = (query: z.infer<typeof listQuerySchema>) => ({
  take: query.limit + 1,
  skip: query.cursor ? 1 : (query.page - 1) * query.limit,
  cursor: query.cursor ? { id: query.cursor } : undefined,
});

const pageResponse = <T extends { id: string }>(items: T[], limit: number) => {
  const hasMore = items.length > limit;
  const visibleItems = hasMore ? items.slice(0, limit) : items;

  return ok(visibleItems, {
    items: visibleItems,
    total: visibleItems.length,
    nextCursor: hasMore ? visibleItems.at(-1)?.id ?? null : null,
  });
};

const channelSelect = {
  id: true,
  name: true,
  provider: true,
  baseUrl: true,
  model: true,
  encryptedKey: true,
  status: true,
  priority: true,
  weight: true,
  rateLimitPerMin: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ChannelSelect;

const tokenSelect = {
  id: true,
  name: true,
  keyPrefix: true,
  status: true,
  quotaRemaining: true,
  metadata: true,
  lastUsedAt: true,
  expiresAt: true,
  revokedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.APIKeySelect;

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
} satisfies Prisma.RedemptionSelect;

const usageSelect = {
  id: true,
  requestId: true,
  provider: true,
  model: true,
  endpoint: true,
  promptTokens: true,
  completionTokens: true,
  totalTokens: true,
  estimatedCostCents: true,
  statusCode: true,
  success: true,
  errorCode: true,
  errorMessage: true,
  latencyMs: true,
  createdAt: true,
  apiKey: {
    select: {
      id: true,
      name: true,
      keyPrefix: true,
    },
  },
  channel: {
    select: {
      id: true,
      name: true,
      provider: true,
      model: true,
    },
  },
  user: {
    select: {
      id: true,
      email: true,
      username: true,
    },
  },
} satisfies Prisma.UsageLogSelect;

const serializeChannel = (channel: Prisma.ChannelGetPayload<{ select: typeof channelSelect }>) => ({
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

const serializeToken = (token: Prisma.APIKeyGetPayload<{ select: typeof tokenSelect }>) => ({
  ...token,
  quotaRemaining: token.quotaRemaining?.toString() ?? null,
  maskedKey: maskApiKey(token.keyPrefix),
});

const serializeRedemption = (redemption: Prisma.RedemptionGetPayload<{ select: typeof redemptionSelect }>) => ({
  ...redemption,
  quotaAmount: redemption.quotaAmount.toString(),
  maskedCode: maskRedemptionCode(redemption.codePrefix),
});

const channelWhere = (keyword?: string): Prisma.ChannelWhereInput => keyword
  ? {
      OR: [
        { name: { contains: keyword, mode: 'insensitive' } },
        { provider: { contains: keyword, mode: 'insensitive' } },
        { model: { contains: keyword, mode: 'insensitive' } },
        { baseUrl: { contains: keyword, mode: 'insensitive' } },
      ],
    }
  : {};

const tokenWhere = (userId: string, keyword?: string): Prisma.APIKeyWhereInput => ({
  userId,
  ...(keyword
    ? {
        OR: [
          { name: { contains: keyword, mode: 'insensitive' } },
          { keyPrefix: { contains: keyword, mode: 'insensitive' } },
        ],
      }
    : {}),
});

const logWhere = (userId: string | null, keyword?: string): Prisma.UsageLogWhereInput => ({
  ...(userId ? { userId } : {}),
  ...(keyword
    ? {
        OR: [
          { requestId: { contains: keyword, mode: 'insensitive' } },
          { provider: { contains: keyword, mode: 'insensitive' } },
          { model: { contains: keyword, mode: 'insensitive' } },
          { endpoint: { contains: keyword, mode: 'insensitive' } },
          { user: { email: { contains: keyword, mode: 'insensitive' } } },
          { user: { username: { contains: keyword, mode: 'insensitive' } } },
          { apiKey: { name: { contains: keyword, mode: 'insensitive' } } },
          { channel: { name: { contains: keyword, mode: 'insensitive' } } },
        ],
      }
    : {}),
});

const summarizeUsage = async (where: Prisma.UsageLogWhereInput) => {
  const [total, success, aggregate] = await Promise.all([
    prisma.usageLog.count({ where }),
    prisma.usageLog.count({ where: { ...where, success: true } }),
    prisma.usageLog.aggregate({
      where,
      _sum: {
        promptTokens: true,
        completionTokens: true,
        totalTokens: true,
        estimatedCostCents: true,
      },
    }),
  ]);

  return {
    quota: aggregate._sum.estimatedCostCents ?? 0,
    rpm: total,
    tpm: aggregate._sum.totalTokens ?? 0,
    requests: total,
    success,
    failed: total - success,
    promptTokens: aggregate._sum.promptTokens ?? 0,
    completionTokens: aggregate._sum.completionTokens ?? 0,
    totalTokens: aggregate._sum.totalTokens ?? 0,
  };
};

const compatibilityRoutes: FastifyPluginAsync = async (app) => {
  app.get('/channel', { preHandler: app.requireAdminUser }, async (request) => {
    const query = listQuerySchema.parse(request.query);
    const channels = await prisma.channel.findMany({
      where: channelWhere(query.keyword),
      orderBy: [{ priority: 'desc' }, { weight: 'desc' }, { createdAt: 'desc' }],
      ...paginate(query),
      select: channelSelect,
    });

    return pageResponse(channels.map(serializeChannel), query.limit);
  });

  app.get('/channel/search', { preHandler: app.requireAdminUser }, async (request) => {
    const query = listQuerySchema.parse(request.query);
    const channels = await prisma.channel.findMany({
      where: channelWhere(query.keyword),
      orderBy: [{ priority: 'desc' }, { weight: 'desc' }, { createdAt: 'desc' }],
      ...paginate(query),
      select: channelSelect,
    });

    return pageResponse(channels.map(serializeChannel), query.limit);
  });

  app.get('/channel/models', { preHandler: app.requireAdminUser }, async () => {
    const channels = await prisma.channel.findMany({
      select: { model: true, metadata: true },
    });
    const models = [...new Set(channels.flatMap(getChannelSupportedModels))].sort();

    return ok(models, { items: models });
  });

  app.get('/channel/models_enabled', { preHandler: app.requireAdminUser }, async () => {
    const channels = await prisma.channel.findMany({
      where: { status: 'ACTIVE' },
      select: { model: true, metadata: true },
    });
    const models = [...new Set(channels.flatMap(getChannelSupportedModels))].sort();

    return ok(models, { items: models });
  });

  app.get('/channel/:id', { preHandler: app.requireAdminUser }, async (request) => {
    const { id } = idParamsSchema.parse(request.params);
    const channel = await prisma.channel.findUnique({
      where: { id },
      select: channelSelect,
    });

    if (!channel) {
      throw app.httpErrors.notFound('Channel not found');
    }

    const item = serializeChannel(channel);
    return ok(item, { item });
  });

  app.post('/channel', { preHandler: app.requireAdminUser }, async (request, reply) => {
    const body = channelBodySchema.parse(request.body);
    const apiKey = body.apiKey ?? body.key;

    if (!apiKey) {
      throw app.httpErrors.badRequest('Channel apiKey is required');
    }

    const channel = await prisma.channel.create({
      data: {
        name: body.name,
        provider: body.provider,
        baseUrl: body.baseUrl ?? null,
        model: body.model ?? null,
        encryptedKey: encryptChannelKey(apiKey),
        status: body.status,
        priority: body.priority,
        weight: body.weight,
        rateLimitPerMin: body.rateLimitPerMin ?? null,
        metadata: body.metadata === null ? Prisma.JsonNull : body.metadata as Prisma.InputJsonValue | undefined,
      },
      select: channelSelect,
    });
    const item = serializeChannel(channel);

    return reply.code(201).send(ok(item, { item }));
  });

  app.put('/channel', { preHandler: app.requireAdminUser }, async (request) => {
    const body = updateChannelBodySchema.parse(request.body);
    const updateData: Prisma.ChannelUpdateInput = {
      name: body.name,
      provider: body.provider,
      baseUrl: body.baseUrl,
      model: body.model,
      status: body.status,
      priority: body.priority,
      weight: body.weight,
      rateLimitPerMin: body.rateLimitPerMin,
    };

    const apiKey = body.apiKey ?? body.key;
    if (apiKey) {
      updateData.encryptedKey = encryptChannelKey(apiKey);
    }

    if (body.metadata !== undefined) {
      updateData.metadata = body.metadata === null ? Prisma.JsonNull : body.metadata as Prisma.InputJsonValue;
    }

    const channel = await prisma.channel.update({
      where: { id: body.id },
      data: updateData,
      select: channelSelect,
    });
    const item = serializeChannel(channel);

    return ok(item, { item });
  });

  app.delete('/channel/disabled', { preHandler: app.requireAdminUser }, async () => {
    const result = await prisma.channel.deleteMany({ where: { status: 'DISABLED' } });
    return ok(null, { count: result.count });
  });

  app.delete('/channel/:id', { preHandler: app.requireAdminUser }, async (request) => {
    const { id } = idParamsSchema.parse(request.params);
    const result = await prisma.channel.deleteMany({ where: { id } });

    if (result.count === 0) {
      throw app.httpErrors.notFound('Channel not found');
    }

    return ok(null, { count: result.count });
  });

  app.post('/channel/batch', { preHandler: app.requireAdminUser }, async (request) => {
    const { ids } = batchIdsBodySchema.parse(request.body);
    const result = await prisma.channel.deleteMany({ where: { id: { in: ids } } });

    return ok(null, { count: result.count });
  });

  app.post('/channel/copy/:id', { preHandler: app.requireAdminUser }, async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params);
    const source = await prisma.channel.findUnique({
      where: { id },
      select: channelSelect,
    });

    if (!source) {
      throw app.httpErrors.notFound('Channel not found');
    }

    const channel = await prisma.channel.create({
      data: {
        name: `${source.name} Copy`,
        provider: source.provider,
        baseUrl: source.baseUrl,
        model: source.model,
        encryptedKey: source.encryptedKey,
        status: source.status,
        priority: source.priority,
        weight: source.weight,
        rateLimitPerMin: source.rateLimitPerMin,
        metadata: source.metadata === null ? Prisma.JsonNull : source.metadata as Prisma.InputJsonValue,
      },
      select: channelSelect,
    });
    const item = serializeChannel(channel);

    return reply.code(201).send(ok(item, { item }));
  });

  app.get('/token/search', { preHandler: app.requireUser }, async (request) => {
    const query = listQuerySchema.parse(request.query);
    const tokens = await prisma.aPIKey.findMany({
      where: tokenWhere(request.currentUser!.id, query.keyword),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...paginate(query),
      select: tokenSelect,
    });

    return pageResponse(tokens.map(serializeToken), query.limit);
  });

  app.get('/token/:id', { preHandler: app.requireUser }, async (request) => {
    const { id } = idParamsSchema.parse(request.params);
    const token = await prisma.aPIKey.findFirst({
      where: { id, userId: request.currentUser!.id },
      select: tokenSelect,
    });

    if (!token) {
      throw app.httpErrors.notFound('API key not found');
    }

    const item = serializeToken(token);
    return ok(item, { item });
  });

  app.put('/token', { preHandler: app.requireUser }, async (request) => {
    const body = updateTokenBodySchema.parse(request.body);

    const existing = await prisma.aPIKey.findFirst({
      where: {
        id: body.id,
        userId: request.currentUser!.id,
      },
      select: { id: true },
    });

    if (!existing) {
      throw app.httpErrors.notFound('API key not found');
    }

    const token = await prisma.aPIKey.update({
      where: { id: body.id },
      data: {
        name: body.name,
        status: body.status,
        quotaRemaining: body.quotaRemaining,
        expiresAt: body.expiresAt === null ? null : body.expiresAt ? new Date(body.expiresAt) : undefined,
        metadata: body.metadata === null ? Prisma.JsonNull : body.metadata as Prisma.InputJsonValue | undefined,
        revokedAt: body.status === 'REVOKED' ? new Date() : body.status === 'ACTIVE' ? null : undefined,
      },
      select: tokenSelect,
    });

    const item = serializeToken(token);
    return ok(item, { item });
  });

  app.post('/token/batch', { preHandler: app.requireUser }, async (request) => {
    const { ids } = batchIdsBodySchema.parse(request.body);
    const result = await prisma.aPIKey.deleteMany({
      where: { id: { in: ids }, userId: request.currentUser!.id },
    });

    return ok(null, { count: result.count });
  });

  app.post('/token/batch/keys', { preHandler: app.requireUser }, async (request) => {
    const { ids } = batchIdsBodySchema.parse(request.body);
    const tokens = await prisma.aPIKey.findMany({
      where: { id: { in: ids }, userId: request.currentUser!.id },
      select: { id: true, keyPrefix: true },
    });

    return ok(tokens.map((token) => ({
      id: token.id,
      keyPrefix: token.keyPrefix,
      maskedKey: maskApiKey(token.keyPrefix),
      note: 'Plaintext keys are only returned when the key is created.',
    })));
  });

  app.get('/log/stat', { preHandler: app.requireAdminUser }, async (request) => {
    const query = listQuerySchema.parse(request.query);
    return ok(await summarizeUsage(logWhere(null, query.keyword)));
  });

  app.get('/log/self/stat', { preHandler: app.requireUser }, async (request) => {
    const query = listQuerySchema.parse(request.query);
    return ok(await summarizeUsage(logWhere(request.currentUser!.id, query.keyword)));
  });

  app.get('/log', { preHandler: app.requireAdminUser }, async (request) => {
    const query = listQuerySchema.parse(request.query);
    const logs = await prisma.usageLog.findMany({
      where: logWhere(null, query.keyword),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...paginate(query),
      select: usageSelect,
    });

    return pageResponse(logs, query.limit);
  });

  app.get('/log/search', { preHandler: app.requireAdminUser }, async (request) => {
    const query = listQuerySchema.parse(request.query);
    const logs = await prisma.usageLog.findMany({
      where: logWhere(null, query.keyword),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...paginate(query),
      select: usageSelect,
    });

    return pageResponse(logs, query.limit);
  });

  app.get('/log/self', { preHandler: app.requireUser }, async (request) => {
    const query = listQuerySchema.parse(request.query);
    const logs = await prisma.usageLog.findMany({
      where: logWhere(request.currentUser!.id, query.keyword),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...paginate(query),
      select: usageSelect,
    });

    return pageResponse(logs, query.limit);
  });

  app.get('/log/self/search', { preHandler: app.requireUser }, async (request) => {
    const query = listQuerySchema.parse(request.query);
    const logs = await prisma.usageLog.findMany({
      where: logWhere(request.currentUser!.id, query.keyword),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...paginate(query),
      select: usageSelect,
    });

    return pageResponse(logs, query.limit);
  });

  app.delete('/log', { preHandler: app.requireAdminUser }, async () => {
    const result = await prisma.usageLog.deleteMany();
    return ok(null, { count: result.count });
  });

  app.get('/redemption', { preHandler: app.requireAdminUser }, async (request) => {
    const query = listQuerySchema.parse(request.query);
    const items = await prisma.redemption.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...paginate(query),
      select: redemptionSelect,
    });

    return pageResponse(items.map(serializeRedemption), query.limit);
  });

  app.get('/redemption/search', { preHandler: app.requireAdminUser }, async (request) => {
    const query = listQuerySchema.parse(request.query);
    const items = await prisma.redemption.findMany({
      where: query.keyword ? { codePrefix: { contains: query.keyword, mode: 'insensitive' } } : undefined,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...paginate(query),
      select: redemptionSelect,
    });

    return pageResponse(items.map(serializeRedemption), query.limit);
  });

  app.get('/redemption/:id', { preHandler: app.requireAdminUser }, async (request) => {
    const { id } = idParamsSchema.parse(request.params);
    const redemption = await prisma.redemption.findUnique({
      where: { id },
      select: redemptionSelect,
    });

    if (!redemption) {
      throw app.httpErrors.notFound('Redemption not found');
    }

    const item = serializeRedemption(redemption);
    return ok(item, { item });
  });

  app.post('/redemption', { preHandler: app.requireAdminUser }, async (request, reply) => {
    const body = redemptionBodySchema.parse(request.body);
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
    const item = { ...serializeRedemption(redemption), code };

    return reply.code(201).send(ok(item, { item }));
  });

  app.put('/redemption', { preHandler: app.requireAdminUser }, async (request) => {
    const body = updateRedemptionBodySchema.parse(request.body);
    const redemption = await prisma.redemption.update({
      where: { id: body.id },
      data: {
        quotaAmount: body.quotaAmount,
        status: body.status,
        expiresAt: body.expiresAt === null ? null : body.expiresAt ? new Date(body.expiresAt) : undefined,
      },
      select: redemptionSelect,
    });
    const item = serializeRedemption(redemption);

    return ok(item, { item });
  });

  app.delete('/redemption/invalid', { preHandler: app.requireAdminUser }, async () => {
    const result = await prisma.redemption.deleteMany({
      where: {
        OR: [
          { status: { not: 'ACTIVE' } },
          { expiresAt: { lt: new Date() } },
        ],
      },
    });

    return ok(null, { count: result.count });
  });

  app.delete('/redemption/:id', { preHandler: app.requireAdminUser }, async (request) => {
    const { id } = idParamsSchema.parse(request.params);
    const result = await prisma.redemption.deleteMany({ where: { id } });

    if (result.count === 0) {
      throw app.httpErrors.notFound('Redemption not found');
    }

    return ok(null, { count: result.count });
  });

  app.get('/group', { preHandler: app.requireAdminUser }, async () => {
    const groups = await prisma.group.findMany({
      orderBy: { name: 'asc' },
      select: { name: true },
    });

    return ok(groups.map((group) => group.name));
  });

  app.get('/user/groups', { preHandler: app.requireUser }, async () => {
    const groups = await prisma.group.findMany({
      orderBy: { name: 'asc' },
      select: { name: true, description: true },
    });

    return ok(Object.fromEntries(groups.map((group) => [
      group.name,
      {
        ratio: 1,
        desc: group.description ?? group.name,
      },
    ])));
  });

  app.get('/user/self/groups', { preHandler: app.requireUser }, async () => {
    const groups = await prisma.group.findMany({
      orderBy: { name: 'asc' },
      select: { name: true, description: true },
    });

    return ok(Object.fromEntries(groups.map((group) => [
      group.name,
      {
        ratio: 1,
        desc: group.description ?? group.name,
      },
    ])));
  });
};

export default compatibilityRoutes;
