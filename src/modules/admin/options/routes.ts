import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import {
  evaluateMailConfigInput,
  getMailConfiguration,
  isMailDeliveryEnabled,
  mailConfigBodySchema,
  saveMailConfig,
} from '../../../lib/mail-config.js';
import { buildTestMailMessage, sendMailMessage } from '../../../lib/mailer.js';
import { prisma } from '../../../lib/prisma.js';

const optionKeySchema = z.enum([
  'registration_enabled',
  'registration_email_verification_required',
  'self_use_mode_enabled',
  'demo_site_enabled',
  'checkin_enabled',
  'checkin_min_quota',
  'checkin_max_quota',
  'checkin_reward_quota',
  'passkey_enabled',
  'passkey_rp_display_name',
  'passkey_rp_id',
  'passkey_origins',
  'passkey_allow_insecure_origin',
  'passkey_user_verification',
  'passkey_attachment_preference',
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
    const value = (() => {
      if (params.key === 'checkin_reward_quota' || params.key === 'checkin_min_quota' || params.key === 'checkin_max_quota') {
        return z.coerce.bigint().positive().parse(body.value).toString();
      }

      if (params.key === 'passkey_user_verification') {
        return z.enum(['required', 'preferred', 'discouraged']).parse(String(body.value));
      }

      if (params.key === 'passkey_attachment_preference') {
        return z.enum(['', 'platform', 'cross-platform']).parse(String(body.value));
      }

      return typeof body.value === 'string'
        ? body.value
        : String(body.value);
    })();

    if (params.key === 'registration_email_verification_required' && value === 'true' && !await isMailDeliveryEnabled()) {
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
  }, async () => {
    const configuration = await getMailConfiguration();

    return {
      item: {
        ...configuration.config,
        source: configuration.source,
        valid: configuration.valid,
        errors: configuration.errors,
      },
    };
  });

  app.get('/options/mail/config', {
    preHandler: app.requireAdminUser,
  }, async () => {
    const configuration = await getMailConfiguration();

    return {
      item: configuration.draft,
    };
  });

  app.put('/options/mail/config', {
    preHandler: app.requireAdminUser,
  }, async (request) => {
    const body = mailConfigBodySchema.parse(request.body);
    const evaluation = evaluateMailConfigInput(body);

    if (!evaluation.valid) {
      throw app.httpErrors.badRequest(evaluation.errors[0] ?? 'Mail configuration is invalid');
    }

    const configuration = await saveMailConfig(body);

    if (
      configuration.valid &&
      !configuration.config.enabled
    ) {
      const registrationOption = await prisma.systemOption.findUnique({
        where: { key: 'registration_email_verification_required' },
        select: { value: true },
      });

      if (registrationOption?.value === 'true') {
        await prisma.systemOption.update({
          where: { key: 'registration_email_verification_required' },
          data: { value: 'false' },
        });
      }
    }

    return {
      item: configuration.draft,
      status: {
        ...configuration.config,
        source: configuration.source,
        valid: configuration.valid,
        errors: configuration.errors,
      },
    };
  });

  app.post('/options/mail/test', {
    preHandler: app.requireAdminUser,
  }, async (request, reply) => {
    const body = sendTestMailBodySchema.parse(request.body);

    if (!await isMailDeliveryEnabled()) {
      throw app.httpErrors.badRequest('Mail delivery is not enabled');
    }

    const email = body.email ?? request.currentUser?.email;

    if (!email) {
      throw app.httpErrors.badRequest('Test mail recipient is required');
    }

    await sendMailMessage(await buildTestMailMessage(email));

    return reply.send({
      success: true,
      email,
    });
  });
};

export default optionsRoutes;
