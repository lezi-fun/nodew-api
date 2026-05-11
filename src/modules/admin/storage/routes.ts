import type { FastifyPluginAsync } from 'fastify';

import { getObjectStorageConfig } from '../../../lib/object-storage.js';

const storageRoutes: FastifyPluginAsync = async (app) => {
  app.get('/storage/status', {
    preHandler: app.requireAdminUser,
  }, async () => ({
    success: true,
    data: getObjectStorageConfig(),
  }));
};

export default storageRoutes;
