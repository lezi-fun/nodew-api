import { Prisma } from '@prisma/client';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { prisma } from '../../lib/prisma.js';

const usageQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().cuid().optional(),
  success: z.enum(['true', 'false']).optional(),
});

const usageSummaryQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

const tokenUsageParamsSchema = z.object({
  id: z.string().cuid(),
});

const buildDateWhere = (query: z.infer<typeof usageSummaryQuerySchema>) => ({
  ...(query.from || query.to
    ? {
        createdAt: {
          ...(query.from ? { gte: query.from } : {}),
          ...(query.to ? { lte: query.to } : {}),
        },
      }
    : {}),
});

const summarizeUsage = async (where: Prisma.UsageLogWhereInput) => {
  const [totals, successGroups, providerGroups] = await Promise.all([
    prisma.usageLog.aggregate({
      where,
      _count: { _all: true },
      _sum: {
        promptTokens: true,
        completionTokens: true,
        totalTokens: true,
        estimatedCostCents: true,
      },
      _avg: {
        latencyMs: true,
      },
    }),
    prisma.usageLog.groupBy({
      by: ['success'],
      where,
      _count: { _all: true },
    }),
    prisma.usageLog.groupBy({
      by: ['provider'],
      where,
      _count: { _all: true },
      _sum: {
        totalTokens: true,
        estimatedCostCents: true,
      },
      orderBy: {
        _count: {
          provider: 'desc',
        },
      },
    }),
  ]);
  const successCount = successGroups.find((group) => group.success)?._count._all ?? 0;
  const failedCount = successGroups.find((group) => !group.success)?._count._all ?? 0;

  return {
    requests: totals._count._all,
    success: successCount,
    failed: failedCount,
    promptTokens: totals._sum.promptTokens ?? 0,
    completionTokens: totals._sum.completionTokens ?? 0,
    totalTokens: totals._sum.totalTokens ?? 0,
    estimatedCostCents: totals._sum.estimatedCostCents ?? 0,
    averageLatencyMs: totals._avg.latencyMs ? Math.round(totals._avg.latencyMs) : 0,
    byProvider: providerGroups.map((group) => ({
      provider: group.provider,
      requests: group._count._all,
      totalTokens: group._sum.totalTokens ?? 0,
      estimatedCostCents: group._sum.estimatedCostCents ?? 0,
    })),
  };
};

const paginateLogs = async (params: {
  where: Prisma.UsageLogWhereInput;
  limit: number;
  cursor?: string;
}) => {
  const logs = await prisma.usageLog.findMany({
    where: params.where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: params.limit + 1,
    ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    select: {
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
    },
  });

  const hasMore = logs.length > params.limit;
  const items = hasMore ? logs.slice(0, params.limit) : logs;

  return {
    items: items.map(serializeUsageLog),
    nextCursor: hasMore ? items.at(-1)?.id ?? null : null,
  };
};

const serializeUsageLog = (log: {
  id: string;
  requestId: string | null;
  provider: string;
  model: string | null;
  endpoint: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostCents: number | null;
  statusCode: number | null;
  success: boolean;
  errorCode: string | null;
  errorMessage: string | null;
  latencyMs: number | null;
  createdAt: Date;
  apiKey: { id: string; name: string; keyPrefix: string } | null;
  channel: { id: string; name: string; provider: string; model: string | null } | null;
  user: { id: string; email: string; username: string };
}) => ({
  id: log.id,
  requestId: log.requestId,
  provider: log.provider,
  model: log.model,
  endpoint: log.endpoint,
  promptTokens: log.promptTokens,
  completionTokens: log.completionTokens,
  totalTokens: log.totalTokens,
  estimatedCostCents: log.estimatedCostCents,
  statusCode: log.statusCode,
  success: log.success,
  errorCode: log.errorCode,
  errorMessage: log.errorMessage,
  latencyMs: log.latencyMs,
  createdAt: log.createdAt,
  apiKey: log.apiKey,
  channel: log.channel,
  user: log.user,
});

const usageRoutes: FastifyPluginAsync = async (app) => {
  app.get('/usage/self/summary', {
    preHandler: app.requireUser,
  }, async (request) => {
    const query = usageSummaryQuerySchema.parse(request.query);

    return summarizeUsage({
      userId: request.currentUser!.id,
      ...buildDateWhere(query),
    });
  });

  app.get('/usage/self', {
    preHandler: app.requireUser,
  }, async (request) => {
    const query = usageQuerySchema.parse(request.query);

    return paginateLogs({
      where: {
        userId: request.currentUser!.id,
        ...(query.success ? { success: query.success === 'true' } : {}),
      },
      limit: query.limit,
      cursor: query.cursor,
    });
  });

  app.get('/usage/token/:id', {
    preHandler: app.requireUser,
  }, async (request) => {
    const params = tokenUsageParamsSchema.parse(request.params);
    const query = usageQuerySchema.parse(request.query);

    const apiKey = await prisma.aPIKey.findFirst({
      where: {
        id: params.id,
        userId: request.currentUser!.id,
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        status: true,
        quotaRemaining: true,
        expiresAt: true,
        lastUsedAt: true,
      },
    });

    if (!apiKey) {
      throw app.httpErrors.notFound('API key not found');
    }

    const usage = await paginateLogs({
      where: {
        userId: request.currentUser!.id,
        apiKeyId: apiKey.id,
        ...(query.success ? { success: query.success === 'true' } : {}),
      },
      limit: query.limit,
      cursor: query.cursor,
    });

    return {
      token: {
        id: apiKey.id,
        name: apiKey.name,
        keyPrefix: apiKey.keyPrefix,
        status: apiKey.status,
        quotaRemaining: apiKey.quotaRemaining?.toString() ?? null,
        expiresAt: apiKey.expiresAt,
        lastUsedAt: apiKey.lastUsedAt,
      },
      ...usage,
    };
  });

  app.get('/usage/summary', {
    preHandler: app.requireAdminUser,
  }, async (request) => {
    const query = usageSummaryQuerySchema.parse(request.query);

    return summarizeUsage(buildDateWhere(query));
  });

  app.get('/usage', {
    preHandler: app.requireAdminUser,
  }, async (request) => {
    const query = usageQuerySchema.parse(request.query);

    return paginateLogs({
      where: query.success ? { success: query.success === 'true' } : {},
      limit: query.limit,
      cursor: query.cursor,
    });
  });
};

export default usageRoutes;
