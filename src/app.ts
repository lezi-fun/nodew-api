import path from 'node:path';
import { fileURLToPath } from 'node:url';

import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import sensible from '@fastify/sensible';
import fastifyStatic from '@fastify/static';
import Fastify from 'fastify';

import { env } from './config/env.js';
import { prisma } from './lib/prisma.js';
import apiKeyRoutes from './modules/api-keys/routes.js';
import authRoutes from './modules/auth/routes.js';
import optionsRoutes from './modules/admin/options/routes.js';
import usersRoutes from './modules/admin/users/routes.js';
import channelRoutes from './modules/channels/routes.js';
import relayRoutes from './modules/relay/routes.js';
import selfRoutes from './modules/self/routes.js';
import setupRoutes from './modules/setup/routes.js';
import statusRoutes from './modules/status/routes.js';
import usageRoutes from './modules/usage/routes.js';
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendRoot = path.resolve(__dirname, '../web/dist');

await app.register(sensible);
await app.register(cors, { origin: true, credentials: true });
await app.register(helmet, {
  contentSecurityPolicy:
    env.NODE_ENV === 'development'
      ? {
          directives: {
            upgradeInsecureRequests: null,
          },
        }
      : undefined,
});
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
  await api.register(usersRoutes);
  await api.register(optionsRoutes);
  await api.register(channelRoutes);
  await api.register(usageRoutes);
}, { prefix: '/api' });

await app.register(relayRoutes, { prefix: '/v1' });

await app.register(fastifyStatic, {
  root: frontendRoot,
  prefix: '/',
  wildcard: false,
});

app.setNotFoundHandler(async (request, reply) => {
  if (
    request.raw.method !== 'GET' ||
    request.url.startsWith('/api') ||
    request.url === '/health' ||
    request.url === '/ready' ||
    request.url.startsWith('/assets/') ||
    path.extname(request.url)
  ) {
    return reply.code(404).send({
      statusCode: 404,
      error: 'Not Found',
      message: 'Route not found',
    });
  }

  return reply.sendFile('index.html');
});

const start = async () => {
  try {
    await app.listen({ host: env.HOST, port: env.PORT });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

await start();
