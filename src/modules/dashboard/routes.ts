import type { Prisma } from '@prisma/client';
import type { FastifyPluginAsync } from 'fastify';

import { prisma } from '../../lib/prisma.js';
import { getChannelSupportedModels } from '../relay/model-routing.js';

type ModelSource = {
  id: string;
  name: string;
  provider: string;
  model: string | null;
  status: string;
  weight: number;
  metadata: Prisma.JsonValue | null;
};

const contentOptionKeys = {
  notice: 'notice',
  userAgreement: 'user_agreement',
  privacyPolicy: 'privacy_policy',
  about: 'about',
  homePageContent: 'home_page_content',
} as const;

const defaultContent = {
  notice: '',
  userAgreement: '',
  privacyPolicy: '',
  about: 'nodew-api is a Node.js and TypeScript LLM gateway.',
  homePageContent: '',
} as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

const readMetadata = (metadata: Prisma.JsonValue | null) =>
  isRecord(metadata) ? metadata : {};

const readNumber = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const readString = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

const readModelPrice = (metadata: Prisma.JsonValue | null) => {
  const data = readMetadata(metadata);
  const pricing = isRecord(data.pricing) ? data.pricing : {};

  return {
    promptTokenCost: readNumber(pricing.promptTokenCost ?? pricing.prompt_token_cost ?? data.promptTokenCost ?? data.prompt_token_cost) ?? null,
    completionTokenCost: readNumber(pricing.completionTokenCost ?? pricing.completion_token_cost ?? data.completionTokenCost ?? data.completion_token_cost) ?? null,
    currency: readString(pricing.currency ?? data.currency) ?? 'quota',
  };
};

const readOwnedBy = (metadata: Prisma.JsonValue | null, fallback: string) => {
  const data = readMetadata(metadata);

  return readString(data.ownedBy ?? data.owned_by ?? data.vendor) ?? fallback;
};

const getModelSources = () => prisma.channel.findMany({
  orderBy: [{ provider: 'asc' }, { name: 'asc' }],
  select: {
    id: true,
    name: true,
    provider: true,
    model: true,
    status: true,
    weight: true,
    metadata: true,
  },
});

const getEnabledModelSources = () => prisma.channel.findMany({
  where: {
    status: 'ACTIVE',
  },
  orderBy: [{ provider: 'asc' }, { name: 'asc' }],
  select: {
    id: true,
    name: true,
    provider: true,
    model: true,
    status: true,
    weight: true,
    metadata: true,
  },
});

const buildModelCatalog = (channels: ModelSource[]) => {
  const modelMap = new Map<string, {
    id: string;
    object: 'model';
    created: number;
    owned_by: string;
    ownedBy: string;
    model: string;
    provider: string;
    providers: string[];
    channels: number;
    activeChannels: number;
    channelCount: number;
    weight: number;
    channelIds: string[];
    enabled: boolean;
    promptTokenCost: number | null;
    completionTokenCost: number | null;
    currency: string;
  }>();

  for (const channel of channels) {
    for (const model of getChannelSupportedModels(channel)) {
      const price = readModelPrice(channel.metadata);
      const ownedBy = readOwnedBy(channel.metadata, channel.provider);
      const existing = modelMap.get(model);

      if (existing) {
        if (!existing.providers.includes(channel.provider)) {
          existing.providers.push(channel.provider);
        }

        existing.provider = existing.providers.sort().join(', ');
        existing.channels += 1;
        existing.activeChannels += channel.status === 'ACTIVE' ? 1 : 0;
        existing.channelCount += 1;
        existing.weight += channel.weight;
        existing.channelIds.push(channel.id);
        existing.enabled = existing.activeChannels > 0;
        existing.promptTokenCost ??= price.promptTokenCost;
        existing.completionTokenCost ??= price.completionTokenCost;
        continue;
      }

      modelMap.set(model, {
        id: model,
        model,
        object: 'model',
        created: 0,
        owned_by: ownedBy,
        ownedBy,
        provider: channel.provider,
        providers: [channel.provider],
        channels: 1,
        activeChannels: channel.status === 'ACTIVE' ? 1 : 0,
        channelCount: 1,
        weight: channel.weight,
        channelIds: [channel.id],
        enabled: channel.status === 'ACTIVE',
        promptTokenCost: price.promptTokenCost,
        completionTokenCost: price.completionTokenCost,
        currency: price.currency,
      });
    }
  }

  return [...modelMap.values()].sort((left, right) => left.id.localeCompare(right.id));
};

const optionContent = async (key: keyof typeof contentOptionKeys, fallback: string) => {
  const option = await prisma.systemOption.findUnique({
    where: {
      key: contentOptionKeys[key],
    },
    select: {
      value: true,
      updatedAt: true,
    },
  });

  return {
    success: true,
    message: '',
    data: option?.value ?? fallback,
    content: option?.value ?? fallback,
    updatedAt: option?.updatedAt ?? null,
  };
};

const dashboardRoutes: FastifyPluginAsync = async (app) => {
  app.get('/models', {
    preHandler: app.requireUser,
  }, async () => {
    const models = buildModelCatalog(await getEnabledModelSources());

    return {
      success: true,
      data: models,
      items: models,
      total: models.length,
    };
  });

  app.get('/pricing', async () => {
    const [models, channels, activeChannels] = await Promise.all([
      getModelSources().then(buildModelCatalog),
      prisma.channel.count(),
      prisma.channel.count({ where: { status: 'ACTIVE' } }),
    ]);

    return {
      success: true,
      data: models,
      items: models,
      plans: [
        {
          id: 'self-hosted',
          name: 'Self-hosted',
          price: 0,
          quota: 'Bring your own providers',
          features: ['OpenAI-compatible relay', 'Weighted channel routing', 'Usage logs'],
          current: true,
        },
      ],
      stats: {
        channels,
        activeChannels,
        models: models.length,
      },
      currency: 'quota',
      note: 'Billing plan management is not enabled yet; quota is controlled by user and token balances.',
      vendors: [...new Set(models.flatMap((model) => model.providers))].sort(),
      group_ratio: {
        default: 1,
      },
      usable_group: {
        default: 'default',
      },
      supported_endpoint: {
        chat: ['/v1/chat/completions'],
        responses: ['/v1/responses'],
        embeddings: ['/v1/embeddings'],
        models: ['/v1/models'],
      },
      pricing_version: 'nodew-api-channel-catalog-v1',
    };
  });

  app.get('/ratio_config', async () => ({
    success: true,
    data: {
      model_ratio: {},
      model_price: {},
      completion_ratio: {},
      group_ratio: {
        default: 1,
      },
    },
  }));

  app.get('/notice', async () => optionContent('notice', defaultContent.notice));
  app.get('/user-agreement', async () => optionContent('userAgreement', defaultContent.userAgreement));
  app.get('/privacy-policy', async () => optionContent('privacyPolicy', defaultContent.privacyPolicy));
  app.get('/about', async () => optionContent('about', defaultContent.about));
  app.get('/home_page_content', async () => optionContent('homePageContent', defaultContent.homePageContent));
};

export default dashboardRoutes;
