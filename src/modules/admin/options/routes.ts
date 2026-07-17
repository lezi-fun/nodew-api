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
import {
  createCustomOAuthProvider,
  discoverOIDCConfiguration,
  customOAuthProviderCreateSchema,
  customOAuthProviderUpdateSchema,
  deleteCustomOAuthProvider,
  evaluateOAuthConfigInput,
  getOAuthConfiguration,
  listCustomOAuthProviders,
  oauthConfigBodySchema,
  saveOAuthConfig,
  updateCustomOAuthProvider,
} from '../../../lib/oauth-config.js';
import { prisma } from '../../../lib/prisma.js';
import {
  getPaymentConfiguration,
  paymentConfigBodySchema,
  savePaymentConfig,
} from '../../../lib/payment-config.js';
import { parseSubscriptionPlans, subscriptionPlanOptionKey } from '../../../lib/subscription-plans.js';

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
  subscriptionPlanOptionKey,
]);

const updateOptionBodySchema = z.object({
  value: z.union([z.string(), z.boolean(), z.number()]),
});

const sendTestMailBodySchema = z.object({
  email: z.string().email().optional(),
});

const oidcDiscoveryBodySchema = z.object({
  wellKnownUrl: z.string().trim().url().max(2048),
});

const customOAuthProviderParamsSchema = z.object({
  id: z.string().trim().min(1).max(64),
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

      if (params.key === subscriptionPlanOptionKey) {
        const value = typeof body.value === 'string'
          ? body.value
          : JSON.stringify(body.value);

        parseSubscriptionPlans(value);
        return value;
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

  app.get('/options/payment/config', {
    preHandler: app.requireAdminUser,
  }, async () => ({
    item: (await getPaymentConfiguration()).draft,
  }));

  app.put('/options/payment/config', {
    preHandler: app.requireAdminUser,
  }, async (request) => {
    const parsed = paymentConfigBodySchema.safeParse(request.body);

    if (!parsed.success) {
      throw app.httpErrors.badRequest(parsed.error.issues[0]?.message ?? 'Payment configuration is invalid');
    }

    try {
      const configuration = await savePaymentConfig(parsed.data);
      return {
        item: configuration.draft,
      };
    } catch (error) {
      throw app.httpErrors.badRequest(error instanceof Error ? error.message : 'Payment configuration is invalid');
    }
  });

  app.get('/options/oauth/status', {
    preHandler: app.requireAdminUser,
  }, async () => {
    const configuration = await getOAuthConfiguration();

    return {
      item: {
        ...configuration.status,
        appBaseUrlConfigured: Boolean((process.env.APP_BASE_URL ?? '').trim()),
      },
    };
  });

  app.get('/options/oauth/config', {
    preHandler: app.requireAdminUser,
  }, async () => {
    const configuration = await getOAuthConfiguration();

    return {
      item: configuration.draft,
    };
  });

  app.put('/options/oauth/config', {
    preHandler: app.requireAdminUser,
  }, async (request) => {
    const body = oauthConfigBodySchema.parse(request.body);
    const evaluation = evaluateOAuthConfigInput(body);

    if (!evaluation.status.valid) {
      throw app.httpErrors.badRequest(evaluation.status.errors[0] ?? 'OAuth configuration is invalid');
    }

    const configuration = await saveOAuthConfig(body);

    return {
      item: configuration.draft,
      status: {
        ...configuration.status,
        appBaseUrlConfigured: Boolean((process.env.APP_BASE_URL ?? '').trim()),
      },
    };
  });

  app.post('/options/oauth/oidc/discover', {
    preHandler: app.requireAdminUser,
  }, async (request) => {
    const body = oidcDiscoveryBodySchema.parse(request.body);

    try {
      const item = await discoverOIDCConfiguration(body.wellKnownUrl);

      return {
        item,
      };
    } catch (error) {
      throw app.httpErrors.badRequest(error instanceof Error ? error.message : 'Failed to fetch OIDC discovery document');
    }
  });

  app.get('/options/oauth/custom-providers', {
    preHandler: app.requireAdminUser,
  }, async () => ({
    items: await listCustomOAuthProviders(),
  }));

  app.post('/options/oauth/custom-providers', {
    preHandler: app.requireAdminUser,
  }, async (request) => {
    const body = customOAuthProviderCreateSchema.parse(request.body);

    try {
      return {
        item: await createCustomOAuthProvider(body),
      };
    } catch (error) {
      throw app.httpErrors.badRequest(error instanceof Error ? error.message : 'Failed to create custom OAuth provider');
    }
  });

  app.put('/options/oauth/custom-providers/:id', {
    preHandler: app.requireAdminUser,
  }, async (request) => {
    const params = customOAuthProviderParamsSchema.parse(request.params);
    const body = customOAuthProviderUpdateSchema.parse(request.body);

    try {
      return {
        item: await updateCustomOAuthProvider(params.id, body),
      };
    } catch (error) {
      if (error instanceof Error && error.message === 'Custom OAuth provider not found') {
        throw app.httpErrors.notFound(error.message);
      }

      throw app.httpErrors.badRequest(error instanceof Error ? error.message : 'Failed to update custom OAuth provider');
    }
  });

  app.delete('/options/oauth/custom-providers/:id', {
    preHandler: app.requireAdminUser,
  }, async (request) => {
    const params = customOAuthProviderParamsSchema.parse(request.params);

    try {
      await deleteCustomOAuthProvider(params.id);
    } catch (error) {
      if (error instanceof Error && error.message === 'Custom OAuth provider not found') {
        throw app.httpErrors.notFound(error.message);
      }

      throw error;
    }

    return {
      success: true,
    };
  });

  app.post('/options/oauth/custom-providers/discover', {
    preHandler: app.requireAdminUser,
  }, async (request) => {
    const body = oidcDiscoveryBodySchema.parse(request.body);

    try {
      const item = await discoverOIDCConfiguration(body.wellKnownUrl);

      return {
        item,
      };
    } catch (error) {
      throw app.httpErrors.badRequest(error instanceof Error ? error.message : 'Failed to fetch OIDC discovery document');
    }
  });
};

export default optionsRoutes;
