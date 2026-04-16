import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import sensible from '@fastify/sensible';
import Fastify from 'fastify';

import { env } from './config/env.js';
import { prisma } from './lib/prisma.js';
import apiKeyRoutes from './modules/api-keys/routes.js';
import authRoutes from './modules/auth/routes.js';
import selfRoutes from './modules/self/routes.js';
import setupRoutes from './modules/setup/routes.js';
import statusRoutes from './modules/status/routes.js';
import authPlugin from './plugins/auth.js';

const app = Fastify({
  logger: {
    level: env.LOG_LEVEL,
    transport:
      env.NODE_ENV === 'development'
        ? {
            target: 'pino-pretty',
            options: {
              translateTime: 'HH:MM:ss Z',
              ignore: 'pid,hostname',
            },
          }
        : undefined,
  },
});

await app.register(sensible);
await app.register(cors, { origin: true, credentials: true });
await app.register(helmet);
await app.register(authPlugin);

app.addHook('onSend', async (_request, _reply, payload) => {
  if (typeof payload !== 'string') {
    return payload;
  }

  return payload.replace(/(\d+)n/g, '$1');
});

app.get('/health', async () => ({
  status: 'ok',
  service: 'nodew-api',
  timestamp: new Date().toISOString(),
}));

app.get('/ready', async () => {
  await prisma.$queryRaw`SELECT 1`;

  return {
    status: 'ready',
  };
});

await app.register(async (api) => {
  await api.register(setupRoutes);
  await api.register(statusRoutes);
  await api.register(authRoutes);
  await api.register(selfRoutes);
  await api.register(apiKeyRoutes);
}, { prefix: '/api' });

const start = async () => {
  try {
    await app.listen({ host: env.HOST, port: env.PORT });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

await start();
