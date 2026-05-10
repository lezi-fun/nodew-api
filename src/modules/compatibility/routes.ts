import { Prisma } from '@prisma/client';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import {
  decryptChannelKey,
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
import { getOpenAICompatibleBaseUrl, getProviderExtraHeaders, openAICompatibleProviders } from '../relay/providers.js';

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

const optionBodySchema = z.object({
  key: z.string().trim().min(1).max(128).optional(),
  value: z.union([z.string(), z.boolean(), z.number(), z.null()]).optional(),
}).catchall(z.union([z.string(), z.boolean(), z.number(), z.null()]));

const channelTagBodySchema = z.object({
  tag: z.string().trim().min(1).max(64),
});

const editChannelTagBodySchema = z.object({
  tag: z.string().trim().min(1).max(64).optional(),
  oldTag: z.string().trim().min(1).max(64).optional(),
  newTag: z.string().trim().min(1).max(64),
});

const batchChannelTagBodySchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(100),
  tags: z.array(z.string().trim().min(1).max(64)).max(32),
});

const fetchModelsBodySchema = z.object({
  provider: z.string().min(1).max(32).default('openai'),
  baseUrl: z.string().url().max(2048).optional().nullable(),
  apiKey: z.string().min(1).max(2048),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

const dataQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  userId: z.string().optional(),
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

const toMetadataObject = (metadata: Prisma.JsonValue | null | undefined) =>
  isRecord(metadata) ? metadata as Record<string, unknown> : {};

const getChannelTags = (metadata: Prisma.JsonValue | null | undefined) => {
  const tags = toMetadataObject(metadata).tags;
  return Array.isArray(tags)
    ? tags.filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0)
    : [];
};

const setChannelTags = (metadata: Prisma.JsonValue | null | undefined, tags: string[]) => ({
  ...toMetadataObject(metadata),
  tags: [...new Set(tags)],
});

const getChannelModelsUrl = (channel: {
  provider: string;
  baseUrl: string | null;
  metadata?: Prisma.JsonValue | null;
}) => {
  if (!openAICompatibleProviders.includes(channel.provider as (typeof openAICompatibleProviders)[number])) {
    throw new Error('Model discovery is only supported for OpenAI-compatible channels');
  }

  const normalizedBase = getOpenAICompatibleBaseUrl(channel).replace(/\/+$/, '');
  return normalizedBase.endsWith('/models') ? normalizedBase : `${normalizedBase}/models`;
};

const getChannelChatCompletionsUrl = (channel: {
  provider: string;
  baseUrl: string | null;
  metadata?: Prisma.JsonValue | null;
}) => {
  const normalizedBase = getOpenAICompatibleBaseUrl(channel).replace(/\/+$/, '');
  return normalizedBase.endsWith('/chat/completions') ? normalizedBase : `${normalizedBase}/chat/completions`;
};

const readUpstreamJson = async (response: Response) => {
  const raw = await response.text();
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
};

const extractModels = (body: unknown) => {
  if (!isRecord(body) || !Array.isArray(body.data)) {
    return [] as string[];
  }

  return body.data.flatMap((entry) =>
    isRecord(entry) && typeof entry.id === 'string' ? [entry.id] : []);
};

const discoverChannelModels = async (channel: {
  provider: string;
  baseUrl: string | null;
  encryptedKey: string;
  metadata?: Prisma.JsonValue | null;
}) => {
  const response = await fetch(getChannelModelsUrl(channel), {
    headers: {
      ...getProviderExtraHeaders(channel),
      authorization: `Bearer ${decryptChannelKey(channel.encryptedKey)}`,
    },
  });
  const body = await readUpstreamJson(response);

  return {
    statusCode: response.status,
    success: response.ok,
    body,
    models: response.ok ? extractModels(body) : [],
  };
};

const testChannel = async (channel: {
  id: string;
  provider: string;
  baseUrl: string | null;
  encryptedKey: string;
  model: string | null;
  metadata?: Prisma.JsonValue | null;
}) => {
  if (!openAICompatibleProviders.includes(channel.provider as (typeof openAICompatibleProviders)[number])) {
    throw new Error('Channel test is only supported for OpenAI-compatible channels');
  }

  const url = channel.model ? getChannelChatCompletionsUrl(channel) : getChannelModelsUrl(channel);
  const response = await fetch(url, {
    method: channel.model ? 'POST' : 'GET',
    headers: {
      ...getProviderExtraHeaders(channel),
      ...(channel.model ? { 'content-type': 'application/json' } : {}),
      authorization: `Bearer ${decryptChannelKey(channel.encryptedKey)}`,
    },
    body: channel.model
      ? JSON.stringify({
          model: channel.model,
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 1,
        })
      : undefined,
  });
  const body = await readUpstreamJson(response);

  return {
    channelId: channel.id,
    statusCode: response.status,
    success: response.ok,
    body,
  };
};

const dateRangeWhere = (query: z.infer<typeof dataQuerySchema>) => ({
  ...(query.from || query.to
    ? {
        createdAt: {
          ...(query.from ? { gte: query.from } : {}),
          ...(query.to ? { lte: query.to } : {}),
        },
      }
    : {}),
});

const formatDateBucket = (date: Date) => date.toISOString().slice(0, 10);

const summarizeUsageByDay = async (where: Prisma.UsageLogWhereInput) => {
  const logs = await prisma.usageLog.findMany({
    where,
    orderBy: { createdAt: 'asc' },
    select: {
      createdAt: true,
      userId: true,
      promptTokens: true,
      completionTokens: true,
      totalTokens: true,
      estimatedCostCents: true,
    },
  });
  const buckets = new Map<string, {
    date: string;
    requests: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    quota: number;
    users: Set<string>;
  }>();

  for (const log of logs) {
    const date = formatDateBucket(log.createdAt);
    const bucket = buckets.get(date) ?? {
      date,
      requests: 0,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      quota: 0,
      users: new Set<string>(),
    };

    bucket.requests += 1;
    bucket.promptTokens += log.promptTokens;
    bucket.completionTokens += log.completionTokens;
    bucket.totalTokens += log.totalTokens;
    bucket.quota += log.estimatedCostCents ?? 0;
    bucket.users.add(log.userId);
    buckets.set(date, bucket);
  }

  return [...buckets.values()].map((bucket) => ({
    date: bucket.date,
    requests: bucket.requests,
    promptTokens: bucket.promptTokens,
    completionTokens: bucket.completionTokens,
    totalTokens: bucket.totalTokens,
    quota: bucket.quota,
    users: bucket.users.size,
  }));
};

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

const buildModelRows = async (query: z.infer<typeof listQuerySchema>) => {
  const channels = await prisma.channel.findMany({
    orderBy: [{ priority: 'desc' }, { weight: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      name: true,
      provider: true,
      model: true,
      status: true,
      weight: true,
      metadata: true,
    },
  });
  const modelMap = new Map<string, {
    id: string;
    model: string;
    providers: Set<string>;
    channels: number;
    activeChannels: number;
    weight: number;
    channelIds: string[];
  }>();

  for (const channel of channels) {
    for (const model of getChannelSupportedModels(channel)) {
      const row = modelMap.get(model) ?? {
        id: model,
        model,
        providers: new Set<string>(),
        channels: 0,
        activeChannels: 0,
        weight: 0,
        channelIds: [],
      };

      row.providers.add(channel.provider);
      row.channels += 1;
      row.activeChannels += channel.status === 'ACTIVE' ? 1 : 0;
      row.weight += channel.weight;
      row.channelIds.push(channel.id);
      modelMap.set(model, row);
    }
  }

  const keyword = query.keyword?.toLowerCase();
  const rows = [...modelMap.values()]
    .map((row) => ({
      id: row.id,
      model: row.model,
      provider: [...row.providers].sort().join(', '),
      providers: [...row.providers].sort(),
      channels: row.channels,
      activeChannels: row.activeChannels,
      weight: row.weight,
      channelIds: row.channelIds,
      enabled: row.activeChannels > 0,
    }))
    .filter((row) => keyword
      ? row.model.toLowerCase().includes(keyword) || row.provider.toLowerCase().includes(keyword)
      : true)
    .sort((first, second) => first.model.localeCompare(second.model));

  const start = query.cursor ? Math.max(0, rows.findIndex((row) => row.id === query.cursor) + 1) : (query.page - 1) * query.limit;
  const visibleRows = rows.slice(start, start + query.limit);
  const nextRow = rows[start + query.limit];

  return {
    items: visibleRows,
    total: rows.length,
    nextCursor: nextRow?.id ?? null,
  };
};

const emptyTaskRows = async (type: 'task' | 'mj') => ({
  items: [] as Array<Record<string, unknown>>,
  total: 0,
  type,
  message: `${type === 'mj' ? 'Image task' : 'Task'} persistence is not enabled yet.`,
});

const compatibilityRoutes: FastifyPluginAsync = async (app) => {
  app.get('/models/search', { preHandler: app.requireAdminUser }, async (request) => {
    const query = listQuerySchema.parse(request.query);
    const result = await buildModelRows(query);

    return ok(result.items, {
      items: result.items,
      total: result.total,
      nextCursor: result.nextCursor,
    });
  });

  app.get('/models/missing', { preHandler: app.requireAdminUser }, async () => ok([], {
    items: [],
    total: 0,
  }));

  app.get('/models/:id', { preHandler: app.requireAdminUser }, async (request) => {
    const { id } = idParamsSchema.parse(request.params);
    const result = await buildModelRows({ limit: 100, page: 1 });
    const item = result.items.find((row) => row.model === id);

    if (!item) {
      throw app.httpErrors.notFound('Model not found');
    }

    return ok(item, { item });
  });

  app.get('/task', { preHandler: app.requireAdminUser }, async () => ok(await emptyTaskRows('task')));

  app.get('/task/self', { preHandler: app.requireUser }, async () => ok(await emptyTaskRows('task')));

  app.get('/mj', { preHandler: app.requireAdminUser }, async () => ok(await emptyTaskRows('mj')));

  app.get('/mj/self', { preHandler: app.requireUser }, async () => ok(await emptyTaskRows('mj')));

  app.get('/option', { preHandler: app.requireAdminUser }, async () => {
    const options = await prisma.systemOption.findMany({
      orderBy: { key: 'asc' },
    });
    const data = Object.fromEntries(options.map((option) => [option.key, option.value]));

    return ok(data, { items: options });
  });

  app.put('/option', { preHandler: app.requireAdminUser }, async (request) => {
    const body = optionBodySchema.parse(request.body);
    const entries: Array<[string, string | number | boolean | null | undefined]> = body.key
      ? [[body.key, body.value ?? '']]
      : Object.entries(body).filter(([key]) => key !== 'key' && key !== 'value');

    if (entries.length === 0) {
      throw app.httpErrors.badRequest('No options provided');
    }

    const options = await prisma.$transaction(entries.map(([key, value]) => prisma.systemOption.upsert({
      where: { key },
      update: { value: value === null ? '' : String(value) },
      create: { key, value: value === null ? '' : String(value) },
    })));
    const data = Object.fromEntries(options.map((option) => [option.key, option.value]));

    return ok(data, { items: options });
  });

  app.get('/option/:key', { preHandler: app.requireAdminUser }, async (request) => {
    const { key } = z.object({ key: z.string().trim().min(1).max(128) }).parse(request.params);
    const option = await prisma.systemOption.findUnique({ where: { key } });

    if (!option) {
      throw app.httpErrors.notFound('Option not found');
    }

    return ok(option.value, { item: option });
  });

  app.put('/option/:key', { preHandler: app.requireAdminUser }, async (request) => {
    const { key } = z.object({ key: z.string().trim().min(1).max(128) }).parse(request.params);
    const body = optionBodySchema.parse(request.body);
    const option = await prisma.systemOption.upsert({
      where: { key },
      update: { value: body.value === null || body.value === undefined ? '' : String(body.value) },
      create: { key, value: body.value === null || body.value === undefined ? '' : String(body.value) },
    });

    return ok(option.value, { item: option });
  });

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

  app.get('/channel/test', { preHandler: app.requireAdminUser }, async () => {
    const channels = await prisma.channel.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        name: true,
        provider: true,
        baseUrl: true,
        model: true,
        encryptedKey: true,
        metadata: true,
      },
    });

    const results = await Promise.all(channels.map(async (channel) => {
      try {
        return {
          id: channel.id,
          name: channel.name,
          ...await testChannel(channel),
        };
      } catch (error) {
        return {
          id: channel.id,
          name: channel.name,
          success: false,
          statusCode: 0,
          errorMessage: error instanceof Error ? error.message : 'Channel test failed',
        };
      }
    }));

    return ok(results, { items: results });
  });

  app.get('/channel/test/:id', { preHandler: app.requireAdminUser }, async (request) => {
    const { id } = idParamsSchema.parse(request.params);
    const channel = await prisma.channel.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        provider: true,
        baseUrl: true,
        model: true,
        encryptedKey: true,
        metadata: true,
      },
    });

    if (!channel) {
      throw app.httpErrors.notFound('Channel not found');
    }

    try {
      const result = await testChannel(channel);
      return ok({ id: channel.id, name: channel.name, ...result }, { item: result });
    } catch (error) {
      throw app.httpErrors.badRequest(error instanceof Error ? error.message : 'Channel test failed');
    }
  });

  app.get('/channel/fetch_models/:id', { preHandler: app.requireAdminUser }, async (request) => {
    const { id } = idParamsSchema.parse(request.params);
    const channel = await prisma.channel.findUnique({
      where: { id },
      select: {
        id: true,
        provider: true,
        baseUrl: true,
        encryptedKey: true,
        metadata: true,
      },
    });

    if (!channel) {
      throw app.httpErrors.notFound('Channel not found');
    }

    try {
      const result = await discoverChannelModels(channel);
      return ok(result.models, {
        items: result.models,
        total: result.models.length,
        statusCode: result.statusCode,
      });
    } catch (error) {
      throw app.httpErrors.badRequest(error instanceof Error ? error.message : 'Model discovery failed');
    }
  });

  app.post('/channel/fetch_models', { preHandler: app.requireAdminUser }, async (request) => {
    const body = fetchModelsBodySchema.parse(request.body);
    const result = await discoverChannelModels({
      provider: body.provider,
      baseUrl: body.baseUrl ?? null,
      encryptedKey: encryptChannelKey(body.apiKey),
      metadata: body.metadata as Prisma.JsonValue | null | undefined,
    });

    return ok(result.models, {
      items: result.models,
      total: result.models.length,
      statusCode: result.statusCode,
    });
  });

  app.get('/channel/update_balance', { preHandler: app.requireAdminUser }, async () => {
    const channels = await prisma.channel.findMany({
      select: { id: true, name: true, metadata: true },
    });
    const items = channels.map((channel) => ({
      id: channel.id,
      name: channel.name,
      balance: toMetadataObject(channel.metadata).balance ?? null,
      supportsBalance: false,
    }));

    return ok(items, { items, count: items.length });
  });

  app.get('/channel/update_balance/:id', { preHandler: app.requireAdminUser }, async (request) => {
    const { id } = idParamsSchema.parse(request.params);
    const channel = await prisma.channel.findUnique({
      where: { id },
      select: { id: true, name: true, metadata: true },
    });

    if (!channel) {
      throw app.httpErrors.notFound('Channel not found');
    }

    const item = {
      id: channel.id,
      name: channel.name,
      balance: toMetadataObject(channel.metadata).balance ?? null,
      supportsBalance: false,
    };

    return ok(item, { item });
  });

  app.post('/channel/tag/disabled', { preHandler: app.requireAdminUser }, async (request) => {
    const { tag } = channelTagBodySchema.parse(request.body);
    const channels = await prisma.channel.findMany({
      select: { id: true, metadata: true },
    });
    const ids = channels
      .filter((channel) => getChannelTags(channel.metadata).includes(tag))
      .map((channel) => channel.id);
    const result = ids.length
      ? await prisma.channel.updateMany({ where: { id: { in: ids } }, data: { status: 'DISABLED' } })
      : { count: 0 };

    return ok(null, { count: result.count });
  });

  app.post('/channel/tag/enabled', { preHandler: app.requireAdminUser }, async (request) => {
    const { tag } = channelTagBodySchema.parse(request.body);
    const channels = await prisma.channel.findMany({
      select: { id: true, metadata: true },
    });
    const ids = channels
      .filter((channel) => getChannelTags(channel.metadata).includes(tag))
      .map((channel) => channel.id);
    const result = ids.length
      ? await prisma.channel.updateMany({ where: { id: { in: ids } }, data: { status: 'ACTIVE' } })
      : { count: 0 };

    return ok(null, { count: result.count });
  });

  app.put('/channel/tag', { preHandler: app.requireAdminUser }, async (request) => {
    const body = editChannelTagBodySchema.parse(request.body);
    const oldTag = body.oldTag ?? body.tag;

    if (!oldTag) {
      throw app.httpErrors.badRequest('tag or oldTag is required');
    }

    const channels = await prisma.channel.findMany({
      select: { id: true, metadata: true },
    });
    const updates = channels
      .filter((channel) => getChannelTags(channel.metadata).includes(oldTag))
      .map((channel) => prisma.channel.update({
        where: { id: channel.id },
        data: {
          metadata: setChannelTags(
            channel.metadata,
            getChannelTags(channel.metadata).map((tag) => tag === oldTag ? body.newTag : tag),
          ) as Prisma.InputJsonValue,
        },
      }));

    await prisma.$transaction(updates);
    return ok(null, { count: updates.length });
  });

  app.post('/channel/batch/tag', { preHandler: app.requireAdminUser }, async (request) => {
    const body = batchChannelTagBodySchema.parse(request.body);
    const channels = await prisma.channel.findMany({
      where: { id: { in: body.ids } },
      select: { id: true, metadata: true },
    });

    await prisma.$transaction(channels.map((channel) => prisma.channel.update({
      where: { id: channel.id },
      data: { metadata: setChannelTags(channel.metadata, body.tags) as Prisma.InputJsonValue },
    })));

    return ok(null, { count: channels.length });
  });

  app.get('/channel/tag/models', { preHandler: app.requireAdminUser }, async () => {
    const channels = await prisma.channel.findMany({
      select: { model: true, metadata: true },
    });
    const result: Record<string, string[]> = {};

    for (const channel of channels) {
      for (const tag of getChannelTags(channel.metadata)) {
        result[tag] = [...new Set([...(result[tag] ?? []), ...getChannelSupportedModels(channel)])].sort();
      }
    }

    return ok(result);
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

  app.get('/data', { preHandler: app.requireAdminUser }, async (request) => {
    const query = dataQuerySchema.parse(request.query);
    const items = await summarizeUsageByDay({
      ...dateRangeWhere(query),
    });

    return ok(items, { items, total: items.length });
  });

  app.get('/data/users', { preHandler: app.requireAdminUser }, async (request) => {
    const query = dataQuerySchema.parse(request.query);
    const rows = await prisma.usageLog.groupBy({
      by: ['userId'],
      where: {
        ...dateRangeWhere(query),
        ...(query.userId ? { userId: query.userId } : {}),
      },
      _count: { _all: true },
      _sum: {
        promptTokens: true,
        completionTokens: true,
        totalTokens: true,
        estimatedCostCents: true,
      },
    });
    const users = await prisma.user.findMany({
      where: { id: { in: rows.map((row) => row.userId) } },
      select: { id: true, email: true, username: true },
    });
    const userById = new Map(users.map((user) => [user.id, user]));
    const items = rows.map((row) => ({
      userId: row.userId,
      user: userById.get(row.userId) ?? null,
      requests: row._count._all,
      promptTokens: row._sum.promptTokens ?? 0,
      completionTokens: row._sum.completionTokens ?? 0,
      totalTokens: row._sum.totalTokens ?? 0,
      quota: row._sum.estimatedCostCents ?? 0,
    }));

    return ok(items, { items, total: items.length });
  });

  app.get('/data/self', { preHandler: app.requireUser }, async (request) => {
    const query = dataQuerySchema.parse(request.query);
    const items = await summarizeUsageByDay({
      userId: request.currentUser!.id,
      ...dateRangeWhere(query),
    });

    return ok(items, { items, total: items.length });
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
