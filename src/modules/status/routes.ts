import type { FastifyPluginAsync } from 'fastify';

import { prisma } from '../../lib/prisma.js';

const statusRoutes: FastifyPluginAsync = async (app) => {
  app.get('/status', async () => {
    const [setupState, userCount, adminCount, apiKeyCount, activeApiKeyCount, channelCount] = await Promise.all([
      prisma.setupState.findFirst({
        select: {
          isInitialized: true,
          initializedAt: true,
        },
      }),
      prisma.user.count(),
      prisma.user.count({ where: { role: 'ADMIN' } }),
      prisma.aPIKey.count(),
      prisma.aPIKey.count({ where: { status: 'ACTIVE' } }),
      prisma.channel.count(),
    ]);

    return {
      status: 'ok',
      service: 'nodew-api',
      version: '0.1.0',
      setup: {
        isInitialized: setupState?.isInitialized ?? false,
        initializedAt: setupState?.initializedAt?.toISOString() ?? null,
      },
      counts: {
        users: userCount,
        admins: adminCount,
        apiKeys: apiKeyCount,
        activeApiKeys: activeApiKeyCount,
        channels: channelCount,
      },
    };
  });
};

export default statusRoutes;
