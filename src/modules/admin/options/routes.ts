import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { prisma } from '../../../../src/lib/prisma.js';

const optionKeySchema = z.enum([
  'registration_enabled',
  'self_use_mode_enabled',
  'demo_site_enabled',
  'site_name',
  'site_description',
  'default_model',
]);

const updateOptionBodySchema = z.object({
  value: z.union([z.string(), z.boolean(), z.number()]),
});

const serializeOption = (option: {
  key: string;
  value: string;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  ...option,
});

const optionsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/options', {
    preHandler: app.requireAdminUser,
  }, async () => {
    const options = await prisma.systemOption.findMany({
      where: {
        key: {
          in: optionKeySchema.options,
        },
      },
      orderBy: { key: 'asc' },
    });

    return {
      items: options.map(serializeOption),
    };
  });

  app.get('/options/:key', {
    preHandler: app.requireAdminUser,
  }, async (request) => {
    const params = z.object({ key: optionKeySchema }).parse(request.params);

    const option = await prisma.systemOption.findUnique({
      where: { key: params.key },
    });

    if (!option) {
      throw app.httpErrors.notFound('Option not found');
    }

    return {
      item: serializeOption(option),
    };
  });

  app.put('/options/:key', {
    preHandler: app.requireAdminUser,
  }, async (request) => {
    const params = z.object({ key: optionKeySchema }).parse(request.params);
    const body = updateOptionBodySchema.parse(request.body);
    const value = typeof body.value === 'string' ? body.value : String(body.value);

    const option = await prisma.systemOption.upsert({
      where: { key: params.key },
      update: { value },
      create: {
        key: params.key,
        value,
      },
    });

    return {
      item: serializeOption(option),
    };
  });
};

export default optionsRoutes;
