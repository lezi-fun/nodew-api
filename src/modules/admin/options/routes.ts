import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { parseEnv } from '../../../config/env.js';
import { buildTestMailMessage, isMailDeliveryEnabled, sendMailMessage } from '../../../lib/mailer.js';
import { prisma } from '../../../lib/prisma.js';

const optionKeySchema = z.enum([
  'registration_enabled',
  'registration_email_verification_required',
  'self_use_mode_enabled',
  'demo_site_enabled',
  'site_name',
  'site_description',
  'default_model',
  'notice',
  'user_agreement',
  'privacy_policy',
  'about',
  'home_page_content',
]);

const updateOptionBodySchema = z.object({
  value: z.union([z.string(), z.boolean(), z.number()]),
});

const sendTestMailBodySchema = z.object({
  email: z.string().email().optional(),
});

const serializeOption = (option: {
  key: string;
  value: string;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  ...option,
});

const readMailStatus = () => {
  const env = parseEnv(process.env);

  return {
    provider: env.MAIL_PROVIDER,
    enabled: env.MAIL_PROVIDER !== 'disabled',
    from: env.MAIL_FROM ?? null,
    appBaseUrl: env.APP_BASE_URL ?? null,
  };
};

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

    if (params.key === 'registration_email_verification_required' && value === 'true' && !isMailDeliveryEnabled()) {
      throw app.httpErrors.badRequest('Mail delivery must be enabled before requiring email verification for registration');
    }

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

  app.get('/options/mail/status', {
    preHandler: app.requireAdminUser,
  }, async () => ({
    item: readMailStatus(),
  }));

  app.post('/options/mail/test', {
    preHandler: app.requireAdminUser,
  }, async (request, reply) => {
    const body = sendTestMailBodySchema.parse(request.body);

    if (!isMailDeliveryEnabled()) {
      throw app.httpErrors.badRequest('Mail delivery is not enabled');
    }

    const email = body.email ?? request.currentUser?.email;

    if (!email) {
      throw app.httpErrors.badRequest('Test mail recipient is required');
    }

    await sendMailMessage(buildTestMailMessage(email));

    return reply.send({
      success: true,
      email,
    });
  });
};

export default optionsRoutes;
