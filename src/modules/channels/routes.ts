import { Prisma } from '@prisma/client';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import {
  decryptChannelKey,
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

const channelDetailSelect = channelSelect;

const channelTestSelect = {
  id: true,
  name: true,
  provider: true,
  baseUrl: true,
  model: true,
  encryptedKey: true,
} satisfies Prisma.ChannelSelect;

const channelModelDiscoverySelect = {
  id: true,
  provider: true,
  baseUrl: true,
  encryptedKey: true,
} satisfies Prisma.ChannelSelect;

const channelKeyLookupSelect = {
  id: true,
  encryptedKey: true,
} satisfies Prisma.ChannelSelect;

const channelParamsSchema = z.object({
  id: z.string().cuid(),
});

const channelQuerySchema = z.object({
  provider: z.string().min(1).max(32).optional(),
  status: z.enum(['ACTIVE', 'DISABLED']).optional(),
  keyword: z.string().trim().min(1).max(128).optional(),
});

const channelModelQuerySchema = z.object({
  model: z.string().min(1).max(128).optional(),
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

const testChannelBodySchema = z.object({
  model: z.string().min(1).max(128).optional(),
});

const copyChannelBodySchema = z.object({
  name: z.string().min(1).max(64).optional(),
  suffix: z.string().min(1).max(32).default(' Copy'),
});

const batchChannelStatusBodySchema = z.object({
  ids: z.array(z.string().cuid()).min(1).max(100),
  status: z.enum(['ACTIVE', 'DISABLED']),
});

const batchChannelMetadataBodySchema = z.object({
  ids: z.array(z.string().cuid()).min(1).max(100),
  metadata: z.record(z.string(), z.unknown()).nullable(),
});

const batchChannelTagsBodySchema = z.object({
  ids: z.array(z.string().cuid()).min(1).max(100),
  tags: z.array(z.string().trim().min(1).max(64)).max(32),
});

const tagStatusBodySchema = z.object({
  tag: z.string().trim().min(1).max(64),
  status: z.enum(['ACTIVE', 'DISABLED']),
});

const channelNotFoundMessage = 'Channel not found';
const modelDiscoverySupportMessage = 'Model discovery is only supported for openai channels';
const channelTestSupportMessage = 'Channel test is only supported for openai channels';
const getChannelKeyRouteNote = 'Plaintext keys are only returned when the channel is created.';

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

const serializeChannelTestResult = (channel: {
  id: string;
  name: string;
  provider: string;
  model: string | null;
}, result: { statusCode: number; body: unknown }) => ({
  channelId: channel.id,
  channelName: channel.name,
  provider: channel.provider,
  model: channel.model,
  statusCode: result.statusCode,
  success: result.statusCode >= 200 && result.statusCode < 300,
  errorMessage: result.statusCode >= 200 && result.statusCode < 300 ? null : extractErrorMessage(result.body),
});

const serializeChannelKeyResult = (channel: { id: string; encryptedKey: string }) => ({
  id: channel.id,
  keyPreview: readChannelKeyPreview(channel.encryptedKey),
  note: getChannelKeyRouteNote,
});

const serializeDiscoveredModels = (models: Array<{ id: string; ownedBy: string | null }>) => ({
  items: models,
  total: models.length,
});

const channelListResponse = (channels: Array<Parameters<typeof serializeChannel>[0]>) => ({
  items: channels.map(serializeChannel),
});

const channelDetailResponse = (channel: Parameters<typeof serializeChannel>[0]) => ({
  item: serializeChannel(channel),
});

const channelKeyResponse = (channel: { id: string; encryptedKey: string }) => ({
  item: serializeChannelKeyResult(channel),
});

const channelTestResponse = (channel: {
  id: string;
  name: string;
  provider: string;
  model: string | null;
}, result: { statusCode: number; body: unknown }) => ({
  item: serializeChannelTestResult(channel, result),
});

const channelModelsResponse = (result: { statusCode: number; body: unknown }, models: Array<{ id: string; ownedBy: string | null }>) => ({
  item: {
    statusCode: result.statusCode,
    success: result.statusCode >= 200 && result.statusCode < 300,
    errorMessage: result.statusCode >= 200 && result.statusCode < 300 ? null : extractErrorMessage(result.body),
    ...serializeDiscoveredModels(models),
  },
});

const extractErrorMessage = (body: unknown) => {
  if (body && typeof body === 'object' && 'error' in body) {
    const error = body.error;

    if (typeof error === 'string') {
      return error;
    }

    if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
      return error.message;
    }
  }

  return 'Upstream request failed';
};

const buildChannelWhere = (query: z.infer<typeof channelQuerySchema>): Prisma.ChannelWhereInput => ({
  ...(query.provider ? { provider: query.provider } : {}),
  ...(query.status ? { status: query.status } : {}),
  ...(query.keyword
    ? {
        OR: [
          { name: { contains: query.keyword, mode: 'insensitive' } },
          { provider: { contains: query.keyword, mode: 'insensitive' } },
          { model: { contains: query.keyword, mode: 'insensitive' } },
          { baseUrl: { contains: query.keyword, mode: 'insensitive' } },
        ],
      }
    : {}),
});

const parseChannelId = (params: unknown) => channelParamsSchema.parse(params).id;
const parseChannelQuery = (query: unknown) => channelQuerySchema.parse(query);
const parseChannelModelQuery = (query: unknown) => channelModelQuerySchema.parse(query);
const parseChannelTestBody = (body: unknown) => testChannelBodySchema.parse(body);

const toMetadataObject = (metadata: Prisma.JsonValue | null) => {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return {} as Record<string, unknown>;
  }

  return metadata as Record<string, unknown>;
};

const withTags = (metadata: Prisma.JsonValue | null, tags: string[]) => ({
  ...toMetadataObject(metadata),
  tags,
});

const batchResult = (count: number) => ({
  success: true,
  count,
});

const ensureOpenAIChannel = (provider: string, message: string) => {
  if (provider !== 'openai') {
    throw new Error(message);
  }
};

const getNormalizedBaseUrl = (baseUrl: string | null) => (baseUrl ?? 'https://api.openai.com/v1').replace(/\/+$/, '');

const getChannelModelsUrl = (channel: { provider: string; baseUrl: string | null }) => {
  ensureOpenAIChannel(channel.provider, modelDiscoverySupportMessage);
  const normalizedBase = getNormalizedBaseUrl(channel.baseUrl);
  return normalizedBase.endsWith('/models') ? normalizedBase : `${normalizedBase}/models`;
};

const getChannelChatCompletionsUrl = (channel: { baseUrl: string | null }) => {
  const normalizedBase = getNormalizedBaseUrl(channel.baseUrl);
  return normalizedBase.endsWith('/chat/completions') ? normalizedBase : `${normalizedBase}/chat/completions`;
};

const normalizeModelList = (body: unknown) => {
  if (!body || typeof body !== 'object' || !('data' in body) || !Array.isArray(body.data)) {
    return [] as Array<{ id: string; ownedBy: string | null }>;
  }

  return body.data.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || !('id' in entry) || typeof entry.id !== 'string') {
      return [];
    }

    return [{
      id: entry.id,
      ownedBy: 'owned_by' in entry && typeof entry.owned_by === 'string' ? entry.owned_by : null,
    }];
  });
};

const maybeFilterDiscoveredModels = (models: Array<{ id: string; ownedBy: string | null }>, requestedModel: string | null) => {
  if (!requestedModel) {
    return models;
  }

  return models.filter((model) => model.id.includes(requestedModel));
};

const findChannelList = (query: z.infer<typeof channelQuerySchema>) => prisma.channel.findMany({
  where: buildChannelWhere(query),
  orderBy: [{ priority: 'desc' }, { weight: 'desc' }, { createdAt: 'desc' }],
  select: channelSelect,
});

const findChannelDetailOrThrow = async (id: string) => {
  const channel = await prisma.channel.findUnique({
    where: { id },
    select: channelDetailSelect,
  });

  if (!channel) {
    throw new Error(channelNotFoundMessage);
  }

  return channel;
};

const findChannelKeyOrThrow = async (id: string) => {
  const channel = await prisma.channel.findUnique({
    where: { id },
    select: channelKeyLookupSelect,
  });

  if (!channel) {
    throw new Error(channelNotFoundMessage);
  }

  return channel;
};

const findChannelForTestOrThrow = async (id: string) => {
  const channel = await prisma.channel.findUnique({
    where: { id },
    select: channelTestSelect,
  });

  if (!channel) {
    throw new Error(channelNotFoundMessage);
  }

  return channel;
};

const findChannelForModelsOrThrow = async (id: string) => {
  const channel = await prisma.channel.findUnique({
    where: { id },
    select: channelModelDiscoverySelect,
  });

  if (!channel) {
    throw new Error(channelNotFoundMessage);
  }

  return channel;
};

const readChannelResponseBody = async (response: Response) => {
  const rawBody = await response.text();

  if (!rawBody) {
    return { error: { message: 'Upstream request failed' } };
  }

  try {
    return JSON.parse(rawBody);
  } catch {
    return { error: { message: rawBody } };
  }
};

const testChannelConnection = async (channel: {
  provider: string;
  baseUrl: string | null;
  encryptedKey: string;
}) => {
  ensureOpenAIChannel(channel.provider, channelTestSupportMessage);

  const response = await fetch(getChannelModelsUrl(channel), {
    headers: {
      authorization: `Bearer ${decryptChannelKey(channel.encryptedKey)}`,
    },
  });

  const responseBody = await readChannelResponseBody(response);

  return {
    statusCode: response.status,
    body: responseBody,
  };
};

const readModelDiscovery = async (channel: {
  provider: string;
  baseUrl: string | null;
  encryptedKey: string;
}, requestedModel: string | null) => {
  ensureOpenAIChannel(channel.provider, modelDiscoverySupportMessage);
  const result = await testChannelConnection(channel);

  if (result.statusCode < 200 || result.statusCode >= 300) {
    return {
      result,
      models: [] as Array<{ id: string; ownedBy: string | null }>,
    };
  }

  return {
    result,
    models: maybeFilterDiscoveredModels(normalizeModelList(result.body), requestedModel),
  };
};

const buildTestRequestBody = (model: string) => ({
  model,
  messages: [{ role: 'user', content: 'ping' }],
  max_tokens: 1,
});

const getTestModel = (body: unknown, fallbackModel: string | null) => parseChannelTestBody(body).model ?? fallbackModel;

const runChannelChatTest = async (channel: {
  provider: string;
  baseUrl: string | null;
  encryptedKey: string;
  model: string | null;
}, model: string | null) => {
  ensureOpenAIChannel(channel.provider, channelTestSupportMessage);

  if (!model) {
    return testChannelConnection(channel);
  }

  const response = await fetch(getChannelChatCompletionsUrl(channel), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${decryptChannelKey(channel.encryptedKey)}`,
    },
    body: JSON.stringify(buildTestRequestBody(model)),
  });

  const responseBody = await readChannelResponseBody(response);

  return {
    statusCode: response.status,
    body: responseBody,
  };
};

const throwKnownChannelError = (app: Parameters<FastifyPluginAsync>[0], error: unknown) => {
  if (error instanceof Error && error.message === channelNotFoundMessage) {
    throw app.httpErrors.notFound(channelNotFoundMessage);
  }

  if (error instanceof Error && (error.message === modelDiscoverySupportMessage || error.message === channelTestSupportMessage)) {
    throw app.httpErrors.badRequest(error.message);
  }

  throw error;
};

const channelRoutes: FastifyPluginAsync = async (app) => {
  app.post('/channels/batch/status', {
    preHandler: app.requireAdminUser,
  }, async (request) => {
    const body = batchChannelStatusBodySchema.parse(request.body);
    const result = await prisma.channel.updateMany({
      where: { id: { in: body.ids } },
      data: { status: body.status },
    });

    return batchResult(result.count);
  });

  app.post('/channels/batch/metadata', {
    preHandler: app.requireAdminUser,
  }, async (request) => {
    const body = batchChannelMetadataBodySchema.parse(request.body);
    const result = await prisma.channel.updateMany({
      where: { id: { in: body.ids } },
      data: { metadata: body.metadata === null ? Prisma.JsonNull : body.metadata as Prisma.InputJsonValue },
    });

    return batchResult(result.count);
  });

  app.post('/channels/batch/tags', {
    preHandler: app.requireAdminUser,
  }, async (request) => {
    const body = batchChannelTagsBodySchema.parse(request.body);
    const channels = await prisma.channel.findMany({
      where: { id: { in: body.ids } },
      select: { id: true, metadata: true },
    });

    await prisma.$transaction(channels.map((channel) => prisma.channel.update({
      where: { id: channel.id },
      data: { metadata: withTags(channel.metadata, body.tags) as Prisma.InputJsonValue },
    })));

    return batchResult(channels.length);
  });

  app.post('/channels/tag/status', {
    preHandler: app.requireAdminUser,
  }, async (request) => {
    const body = tagStatusBodySchema.parse(request.body);
    const channels = await prisma.channel.findMany({
      select: { id: true, metadata: true },
    });
    const ids = channels
      .filter((channel) => {
        const tags = toMetadataObject(channel.metadata).tags;
        return Array.isArray(tags) && tags.includes(body.tag);
      })
      .map((channel) => channel.id);

    if (ids.length === 0) {
      return batchResult(0);
    }

    const result = await prisma.channel.updateMany({
      where: { id: { in: ids } },
      data: { status: body.status },
    });

    return batchResult(result.count);
  });

  app.get('/channels', {
    preHandler: app.requireUser,
  }, async (request) => {
    const query = parseChannelQuery(request.query);
    const channels = await findChannelList(query);

    return channelListResponse(channels);
  });

  app.get('/channels/:id', {
    preHandler: app.requireUser,
  }, async (request) => {
    try {
      const channel = await findChannelDetailOrThrow(parseChannelId(request.params));
      return channelDetailResponse(channel);
    } catch (error) {
      return throwKnownChannelError(app, error);
    }
  });

  app.post('/channels/:id/copy', {
    preHandler: app.requireAdminUser,
  }, async (request, reply) => {
    const id = parseChannelId(request.params);
    const body = copyChannelBodySchema.parse(request.body);

    try {
      const source = await findChannelDetailOrThrow(id);
      const channel = await prisma.channel.create({
        data: {
          name: body.name ?? `${source.name}${body.suffix}`,
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

      return reply.code(201).send({
        item: serializeChannel(channel),
      });
    } catch (error) {
      return throwKnownChannelError(app, error);
    }
  });

  app.post('/channels/:id/key', {
    preHandler: app.requireAdminUser,
  }, async (request) => {
    try {
      const channel = await findChannelKeyOrThrow(parseChannelId(request.params));
      return channelKeyResponse(channel);
    } catch (error) {
      return throwKnownChannelError(app, error);
    }
  });

  app.post('/channels/:id/test', {
    preHandler: app.requireAdminUser,
  }, async (request) => {
    try {
      const channel = await findChannelForTestOrThrow(parseChannelId(request.params));
      const result = await runChannelChatTest(channel, getTestModel(request.body, channel.model));
      return channelTestResponse(channel, result);
    } catch (error) {
      return throwKnownChannelError(app, error);
    }
  });

  app.get('/channels/:id/models', {
    preHandler: app.requireAdminUser,
  }, async (request) => {
    try {
      const channel = await findChannelForModelsOrThrow(parseChannelId(request.params));
      const { result, models } = await readModelDiscovery(channel, parseChannelModelQuery(request.query).model ?? null);
      return channelModelsResponse(result, models);
    } catch (error) {
      return throwKnownChannelError(app, error);
    }
  });

  app.post('/channels', {
    preHandler: app.requireAdminUser,
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
    preHandler: app.requireAdminUser,
  }, async (request) => {
    const params = channelParamsSchema.parse(request.params);
    const body = updateChannelBodySchema.parse(request.body);

    const existing = await prisma.channel.findUnique({
      where: { id: params.id },
      select: { id: true },
    });

    if (!existing) {
      throw app.httpErrors.notFound(channelNotFoundMessage);
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
    preHandler: app.requireAdminUser,
  }, async (request) => {
    const params = channelParamsSchema.parse(request.params);

    const deleted = await prisma.channel.deleteMany({
      where: { id: params.id },
    });

    if (deleted.count === 0) {
      throw app.httpErrors.notFound(channelNotFoundMessage);
    }

    return {
      success: true,
    };
  });
};

export default channelRoutes;
