import type { FastifyPluginAsync } from 'fastify';

const statusRoutes: FastifyPluginAsync = async (app) => {
  app.get('/status', async () => ({
    status: 'ok',
    service: 'nodew-api',
    version: '0.1.0',
  }));
};

export default statusRoutes;
