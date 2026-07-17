import { z } from 'zod';

import { parseCreemProducts, type CreemTopUpProduct } from './creem.js';
import { prisma } from './prisma.js';
import { parseWaffoProducts, type WaffoTopUpProduct } from './waffo.js';

const paymentConfigOptionKey = 'payment_config';
const bool = (value: unknown) => ['true', '1', 'yes', 'on'].includes(String(value ?? '').trim().toLowerCase());
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const positiveInt = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const stripeInputSchema = z.object({
  enabled: z.boolean().optional(),
  secretKey: z.string().trim().max(2048).optional(),
  webhookSecret: z.string().trim().max(2048).optional(),
  currency: z.string().trim().min(3).max(16).optional(),
  quotaPerUnit: z.coerce.number().int().positive().optional(),
  unitAmountCents: z.coerce.number().int().positive().optional(),
  minUnits: z.coerce.number().int().positive().optional(),
}).partial();

const productInputSchema = z.object({
  productId: z.string().trim().min(1).max(255),
  name: z.string().trim().min(1).max(255),
  quotaAmount: z.coerce.number().int().positive(),
  amountCents: z.coerce.number().int().positive(),
  currency: z.string().trim().min(3).max(16),
});

const creemInputSchema = z.object({
  enabled: z.boolean().optional(),
  testMode: z.boolean().optional(),
  apiKey: z.string().trim().max(4096).optional(),
  webhookSecret: z.string().trim().max(4096).optional(),
  products: z.array(productInputSchema).max(100).optional(),
}).partial();

const waffoInputSchema = z.object({
  enabled: z.boolean().optional(),
  testMode: z.boolean().optional(),
  apiKey: z.string().trim().max(4096).optional(),
  privateKey: z.string().trim().max(16384).optional(),
  publicKey: z.string().trim().max(16384).optional(),
  products: z.array(productInputSchema).max(100).optional(),
}).partial();

export const paymentConfigBodySchema = z.object({
  appBaseUrl: z.string().trim().max(2048).optional(),
  stripe: stripeInputSchema.optional(),
  creem: creemInputSchema.optional(),
  waffo: waffoInputSchema.optional(),
}).strict();

export type PaymentConfigInput = z.infer<typeof paymentConfigBodySchema>;

type StripeDraft = {
  enabled: boolean;
  secretKey: string;
  webhookSecret: string;
  currency: string;
  quotaPerUnit: number;
  unitAmountCents: number;
  minUnits: number;
};

type CreemDraft = {
  enabled: boolean;
  testMode: boolean;
  apiKey: string;
  webhookSecret: string;
  products: CreemTopUpProduct[];
};

type WaffoDraft = {
  enabled: boolean;
  testMode: boolean;
  apiKey: string;
  privateKey: string;
  publicKey: string;
  products: WaffoTopUpProduct[];
};

type PaymentDraft = {
  appBaseUrl: string;
  stripe: StripeDraft;
  creem: CreemDraft;
  waffo: WaffoDraft;
};

const environmentDraft = (): PaymentDraft => ({
  appBaseUrl: text(process.env.APP_BASE_URL),
  stripe: {
    enabled: bool(process.env.STRIPE_TOPUP_ENABLED),
    secretKey: text(process.env.STRIPE_SECRET_KEY),
    webhookSecret: text(process.env.STRIPE_WEBHOOK_SECRET),
    currency: text(process.env.STRIPE_CURRENCY).toLowerCase() || 'usd',
    quotaPerUnit: positiveInt(process.env.STRIPE_QUOTA_PER_UNIT, 100000),
    unitAmountCents: positiveInt(process.env.STRIPE_UNIT_AMOUNT_CENTS, 100),
    minUnits: positiveInt(process.env.STRIPE_MIN_UNITS, 1),
  },
  creem: {
    enabled: bool(process.env.CREEM_TOPUP_ENABLED),
    testMode: bool(process.env.CREEM_TEST_MODE),
    apiKey: text(process.env.CREEM_API_KEY),
    webhookSecret: text(process.env.CREEM_WEBHOOK_SECRET),
    products: parseCreemProducts(process.env.CREEM_PRODUCTS),
  },
  waffo: {
    enabled: bool(process.env.WAFFO_TOPUP_ENABLED),
    testMode: bool(process.env.WAFFO_TEST_MODE),
    apiKey: text(process.env.WAFFO_API_KEY),
    privateKey: text(process.env.WAFFO_PRIVATE_KEY),
    publicKey: text(process.env.WAFFO_PUBLIC_KEY),
    products: parseWaffoProducts(process.env.WAFFO_PRODUCTS),
  },
});

const normalizeStored = (value: unknown): Partial<PaymentDraft> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  const stripeValue = record.stripe;
  const stripe = stripeValue && typeof stripeValue === 'object' && !Array.isArray(stripeValue)
    ? stripeValue as Record<string, unknown>
    : null;
  const creemValue = record.creem;
  const creem = creemValue && typeof creemValue === 'object' && !Array.isArray(creemValue)
    ? creemValue as Record<string, unknown>
    : null;
  const waffoValue = record.waffo;
  const waffo = waffoValue && typeof waffoValue === 'object' && !Array.isArray(waffoValue)
    ? waffoValue as Record<string, unknown>
    : null;

  return {
    ...(typeof record.appBaseUrl === 'string' ? { appBaseUrl: text(record.appBaseUrl) } : {}),
    ...(stripe ? {
      stripe: {
        enabled: typeof stripe.enabled === 'boolean' ? stripe.enabled : false,
        secretKey: text(stripe.secretKey),
        webhookSecret: text(stripe.webhookSecret),
        currency: text(stripe.currency).toLowerCase() || 'usd',
        quotaPerUnit: positiveInt(stripe.quotaPerUnit, 100000),
        unitAmountCents: positiveInt(stripe.unitAmountCents, 100),
        minUnits: positiveInt(stripe.minUnits, 1),
      },
    } : {}),
    ...(creem ? {
      creem: {
        enabled: typeof creem.enabled === 'boolean' ? creem.enabled : false,
        testMode: typeof creem.testMode === 'boolean' ? creem.testMode : false,
        apiKey: text(creem.apiKey),
        webhookSecret: text(creem.webhookSecret),
        products: parseCreemProducts(JSON.stringify(creem.products ?? [])),
      },
    } : {}),
    ...(waffo ? {
      waffo: {
        enabled: typeof waffo.enabled === 'boolean' ? waffo.enabled : false,
        testMode: typeof waffo.testMode === 'boolean' ? waffo.testMode : false,
        apiKey: text(waffo.apiKey),
        privateKey: text(waffo.privateKey),
        publicKey: text(waffo.publicKey),
        products: parseWaffoProducts(JSON.stringify(waffo.products ?? [])),
      },
    } : {}),
  };
};

const readStoredDraft = async () => {
  const option = await prisma.systemOption.findUnique({
    where: { key: paymentConfigOptionKey },
    select: { value: true },
  });
  if (!option?.value) return {};
  try {
    return normalizeStored(JSON.parse(option.value));
  } catch {
    return {};
  }
};

const mergeDraft = (environment: PaymentDraft, stored: Partial<PaymentDraft>): PaymentDraft => ({
  appBaseUrl: stored.appBaseUrl || environment.appBaseUrl,
  stripe: stored.stripe ? {
    ...stored.stripe,
    secretKey: stored.stripe.secretKey || environment.stripe.secretKey,
    webhookSecret: stored.stripe.webhookSecret || environment.stripe.webhookSecret,
  } : environment.stripe,
  creem: stored.creem ? {
    ...stored.creem,
    apiKey: stored.creem.apiKey || environment.creem.apiKey,
    webhookSecret: stored.creem.webhookSecret || environment.creem.webhookSecret,
  } : environment.creem,
  waffo: stored.waffo ? {
    ...stored.waffo,
    apiKey: stored.waffo.apiKey || environment.waffo.apiKey,
    privateKey: stored.waffo.privateKey || environment.waffo.privateKey,
    publicKey: stored.waffo.publicKey || environment.waffo.publicKey,
  } : environment.waffo,
});

const publicDraft = (draft: PaymentDraft) => ({
  appBaseUrl: draft.appBaseUrl,
  stripe: {
    enabled: draft.stripe.enabled,
    secretKey: '',
    webhookSecret: '',
    hasSecretKey: Boolean(draft.stripe.secretKey),
    hasWebhookSecret: Boolean(draft.stripe.webhookSecret),
    currency: draft.stripe.currency,
    quotaPerUnit: draft.stripe.quotaPerUnit,
    unitAmountCents: draft.stripe.unitAmountCents,
    minUnits: draft.stripe.minUnits,
  },
  creem: {
    enabled: draft.creem.enabled,
    testMode: draft.creem.testMode,
    apiKey: '',
    webhookSecret: '',
    hasApiKey: Boolean(draft.creem.apiKey),
    hasWebhookSecret: Boolean(draft.creem.webhookSecret),
    products: draft.creem.products,
  },
  waffo: {
    enabled: draft.waffo.enabled,
    testMode: draft.waffo.testMode,
    apiKey: '',
    privateKey: '',
    publicKey: '',
    hasApiKey: Boolean(draft.waffo.apiKey),
    hasPrivateKey: Boolean(draft.waffo.privateKey),
    hasPublicKey: Boolean(draft.waffo.publicKey),
    products: draft.waffo.products,
  },
});

export const getPaymentConfiguration = async () => {
  const draft = mergeDraft(environmentDraft(), await readStoredDraft());
  const stripeConfigured = Boolean(draft.appBaseUrl && draft.stripe.secretKey);
  const creemConfigured = Boolean(draft.appBaseUrl && draft.creem.apiKey && draft.creem.products.length > 0);
  const waffoConfigured = Boolean(draft.appBaseUrl && draft.waffo.apiKey && draft.waffo.privateKey && draft.waffo.products.length > 0);
  return {
    draft: publicDraft(draft),
    runtime: {
      appBaseUrl: draft.appBaseUrl,
      stripe: {
        ...draft.stripe,
        configured: stripeConfigured,
        enabled: draft.stripe.enabled && stripeConfigured,
      },
      creem: {
        ...draft.creem,
        configured: creemConfigured,
        webhookConfigured: Boolean(draft.creem.webhookSecret),
        enabled: draft.creem.enabled && creemConfigured,
      },
      waffo: {
        ...draft.waffo,
        configured: waffoConfigured,
        webhookConfigured: Boolean(draft.waffo.publicKey),
        enabled: draft.waffo.enabled && waffoConfigured,
      },
    },
  };
};

export const savePaymentConfig = async (input: PaymentConfigInput) => {
  const environment = environmentDraft();
  const stored = await readStoredDraft();
  const runtime = mergeDraft(environment, stored);
  const stripe = input.stripe;
  const creem = input.creem;
  const waffo = input.waffo;
  const next: Partial<PaymentDraft> = {
    ...(input.appBaseUrl !== undefined || stored.appBaseUrl !== undefined
      ? { appBaseUrl: input.appBaseUrl === undefined ? stored.appBaseUrl : text(input.appBaseUrl) }
      : {}),
    ...(stripe ? {
      stripe: {
        enabled: stripe.enabled ?? runtime.stripe.enabled,
        secretKey: text(stripe.secretKey) || stored.stripe?.secretKey || '',
        webhookSecret: text(stripe.webhookSecret) || stored.stripe?.webhookSecret || '',
        currency: text(stripe.currency).toLowerCase() || runtime.stripe.currency,
        quotaPerUnit: stripe.quotaPerUnit ?? runtime.stripe.quotaPerUnit,
        unitAmountCents: stripe.unitAmountCents ?? runtime.stripe.unitAmountCents,
        minUnits: stripe.minUnits ?? runtime.stripe.minUnits,
      },
    } : stored.stripe ? { stripe: stored.stripe } : {}),
    ...(creem ? {
      creem: {
        enabled: creem.enabled ?? runtime.creem.enabled,
        testMode: creem.testMode ?? runtime.creem.testMode,
        apiKey: text(creem.apiKey) || stored.creem?.apiKey || '',
        webhookSecret: text(creem.webhookSecret) || stored.creem?.webhookSecret || '',
        products: creem.products
          ? parseCreemProducts(JSON.stringify(creem.products))
          : runtime.creem.products,
      },
    } : stored.creem ? { creem: stored.creem } : {}),
    ...(waffo ? {
      waffo: {
        enabled: waffo.enabled ?? runtime.waffo.enabled,
        testMode: waffo.testMode ?? runtime.waffo.testMode,
        apiKey: text(waffo.apiKey) || stored.waffo?.apiKey || '',
        privateKey: text(waffo.privateKey) || stored.waffo?.privateKey || '',
        publicKey: text(waffo.publicKey) || stored.waffo?.publicKey || '',
        products: waffo.products
          ? parseWaffoProducts(JSON.stringify(waffo.products))
          : runtime.waffo.products,
      },
    } : stored.waffo ? { waffo: stored.waffo } : {}),
  };

  if (next.appBaseUrl) z.string().url().parse(next.appBaseUrl);
  await prisma.systemOption.upsert({
    where: { key: paymentConfigOptionKey },
    update: { value: JSON.stringify(next) },
    create: { key: paymentConfigOptionKey, value: JSON.stringify(next) },
  });
  return getPaymentConfiguration();
};
