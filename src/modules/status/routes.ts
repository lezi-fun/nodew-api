import type { FastifyPluginAsync } from 'fastify';

import { getPasskeySettings } from '../../lib/passkey.js';
import { prisma } from '../../lib/prisma.js';

const statusRoutes: FastifyPluginAsync = async (app) => {
  app.get('/status', async () => {
    const [setupState, userCount, adminCount, apiKeyCount, activeApiKeyCount, channelCount, passkeySettings] = await Promise.all([
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
      getPasskeySettings(),
    ]);

    return {
      status: 'ok',
      service: 'NodEW-api',
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
      passkey: {
        enabled: passkeySettings.enabled,
      },
      oauth: {
        github: {
          enabled: Boolean(
            (process.env.GITHUB_OAUTH_CLIENT_ID ?? '').trim()
            && (process.env.GITHUB_OAUTH_CLIENT_SECRET ?? '').trim()
            && (process.env.APP_BASE_URL ?? '').trim(),
          ),
        },
        discord: {
          enabled: Boolean(
            (process.env.DISCORD_OAUTH_CLIENT_ID ?? '').trim()
            && (process.env.DISCORD_OAUTH_CLIENT_SECRET ?? '').trim()
            && (process.env.APP_BASE_URL ?? '').trim(),
          ),
        },
        linuxdo: {
          enabled: Boolean(
            (process.env.LINUXDO_OAUTH_CLIENT_ID ?? '').trim()
            && (process.env.LINUXDO_OAUTH_CLIENT_SECRET ?? '').trim()
            && (process.env.APP_BASE_URL ?? '').trim(),
          ),
        },
      },
    };
  });
};

export default statusRoutes;
