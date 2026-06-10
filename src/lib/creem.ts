import { createHmac, timingSafeEqual } from 'node:crypto';

import { z } from 'zod';

export type CreemTopUpProduct = {
  productId: string;
  name: string;
  quotaAmount: number;
  amountCents: number;
  currency: string;
};

export type CreemTopUpConfig = {
  enabled: boolean;
  configured: boolean;
  webhookConfigured: boolean;
  testMode: boolean;
  products: CreemTopUpProduct[];
};

const creemCheckoutResponseSchema = z.object({
  id: z.string().trim().min(1),
  checkout_url: z.string().trim().url(),
  request_id: z.string().trim().min(1).optional(),
  order: z.union([
    z.string().trim().min(1),
    z.object({
      id: z.string().trim().min(1).optional(),
    }),
  ]).optional(),
});

const readBooleanEnv = (value: string | undefined) =>
  ['true', '1', 'yes', 'on'].includes(value?.trim().toLowerCase() ?? '');

const creemProductSchema = z.object({
  productId: z.string().trim().min(1).optional(),
  product_id: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1).optional(),
  quotaAmount: z.coerce.number().int().positive().optional(),
  quota: z.coerce.number().int().positive().optional(),
  amountCents: z.coerce.number().int().positive().optional(),
  priceCents: z.coerce.number().int().positive().optional(),
  price: z.coerce.number().positive().optional(),
  currency: z.string().trim().min(3).max(16).optional(),
});

const normalizeCreemProduct = (input: unknown): CreemTopUpProduct | null => {
  const parsed = creemProductSchema.safeParse(input);

  if (!parsed.success) {
    return null;
  }

  const productId = parsed.data.productId ?? parsed.data.product_id;
  const quotaAmount = parsed.data.quotaAmount ?? parsed.data.quota;
  const amountCents = parsed.data.amountCents ?? parsed.data.priceCents ?? (
    parsed.data.price ? Math.round(parsed.data.price * 100) : undefined
  );

  if (!productId || !quotaAmount || !amountCents) {
    return null;
  }

  return {
    productId,
    name: parsed.data.name ?? productId,
    quotaAmount,
    amountCents,
    currency: (parsed.data.currency ?? 'usd').toLowerCase(),
  };
};

export const parseCreemProducts = (rawProducts = '[]') => {
  try {
    const parsed = JSON.parse(rawProducts);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map(normalizeCreemProduct)
      .filter((product): product is CreemTopUpProduct => Boolean(product));
  } catch {
    return [];
  }
};

export const getCreemTopUpConfig = (): CreemTopUpConfig => {
  const products = parseCreemProducts(process.env.CREEM_PRODUCTS);
  const configured = Boolean(
    process.env.CREEM_API_KEY?.trim() &&
    process.env.APP_BASE_URL?.trim() &&
    products.length > 0,
  );

  return {
    enabled: readBooleanEnv(process.env.CREEM_TOPUP_ENABLED) && configured,
    configured,
    webhookConfigured: Boolean(process.env.CREEM_WEBHOOK_SECRET?.trim()),
    testMode: readBooleanEnv(process.env.CREEM_TEST_MODE),
    products,
  };
};

const readCreemErrorMessage = (payload: unknown) => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const message = (payload as { message?: unknown }).message;

  if (typeof message === 'string' && message.trim()) {
    return message.trim();
  }

  const error = (payload as { error?: unknown }).error;

  if (typeof error === 'string' && error.trim()) {
    return error.trim();
  }

  if (!error || typeof error !== 'object') {
    return null;
  }

  const nestedMessage = (error as { message?: unknown }).message;
  return typeof nestedMessage === 'string' && nestedMessage.trim() ? nestedMessage.trim() : null;
};

const getCreemApiBaseUrl = (testMode: boolean) =>
  testMode ? 'https://test-api.creem.io' : 'https://api.creem.io';

const safeEqualHex = (left: string, right: string) => {
  const leftBuffer = Buffer.from(left, 'hex');
  const rightBuffer = Buffer.from(right, 'hex');

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
};

export const verifyCreemWebhookSignature = (payload: string, signature: string, secret: string) => {
  const expected = createHmac('sha256', secret).update(payload).digest('hex');

  if (!safeEqualHex(signature.trim(), expected)) {
    throw new Error('Creem webhook signature is invalid');
  }
};

export const createCreemCheckoutSession = async (input: {
  apiKey: string;
  product: CreemTopUpProduct;
  requestId: string;
  userId: string;
  userEmail: string;
  successUrl: string;
  testMode: boolean;
}) => {
  const response = await fetch(`${getCreemApiBaseUrl(input.testMode)}/v1/checkouts`, {
    method: 'POST',
    headers: {
      'x-api-key': input.apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      product_id: input.product.productId,
      request_id: input.requestId,
      success_url: input.successUrl,
      quantity: 1,
      customer: {
        id: input.userId,
        email: input.userEmail,
      },
      metadata: {
        provider: 'creem',
        productId: input.product.productId,
        quotaAmount: String(input.product.quotaAmount),
        amountCents: String(input.product.amountCents),
      },
    }),
  });
  const json = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(readCreemErrorMessage(json) ?? 'Failed to create Creem checkout session');
  }

  const parsed = creemCheckoutResponseSchema.safeParse(json);

  if (!parsed.success) {
    throw new Error('Failed to create Creem checkout session');
  }

  const orderValue = parsed.data.order;
  const orderId =
    typeof orderValue === 'string'
      ? orderValue
      : orderValue?.id?.trim() || null;

  return {
    id: parsed.data.id,
    url: parsed.data.checkout_url,
    requestId: parsed.data.request_id?.trim() || input.requestId,
    orderId,
  };
};
