import type { FastifyPluginAsync } from 'fastify';

import { getOAuthConfiguration, listEnabledCustomOAuthProviders } from '../../lib/oauth-config.js';
import { getPasskeySettings } from '../../lib/passkey.js';
import { prisma } from '../../lib/prisma.js';

const statusRoutes: FastifyPluginAsync = async (app) => {
  app.get('/status', async () => {
    const [
      setupState,
      userCount,
      adminCount,
      apiKeyCount,
      activeApiKeyCount,
      channelCount,
      passkeySettings,
      oauthConfiguration,
      customOAuthProviders,
    ] = await Promise.all([
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
      getOAuthConfiguration(),
      listEnabledCustomOAuthProviders(),
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
        oidc: {
          enabled: oauthConfiguration.status.oidc.enabled && Boolean((process.env.APP_BASE_URL ?? '').trim()),
        },
        customProviders: customOAuthProviders
          .filter((provider) => Boolean((process.env.APP_BASE_URL ?? '').trim()))
          .map(({ id, name, slug, icon, enabled }) => ({
            id,
            name,
            slug,
            icon,
            enabled,
          })),
      },
    };
  });
};

export default statusRoutes;
