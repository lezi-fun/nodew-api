import { createPrivateKey, createPublicKey, createSign, createVerify } from 'node:crypto';

import { z } from 'zod';

export type WaffoTopUpProduct = {
  productId: string;
  name: string;
  quotaAmount: number;
  amountCents: number;
  currency: string;
};

export type WaffoTopUpConfig = {
  enabled: boolean;
  configured: boolean;
  webhookConfigured: boolean;
  testMode: boolean;
  products: WaffoTopUpProduct[];
};

const waffoCheckoutResponseSchema = z.object({
  code: z.union([z.string(), z.number()]).optional(),
  msg: z.string().optional(),
  message: z.string().optional(),
  data: z.object({
    id: z.string().trim().min(1).optional(),
    orderId: z.string().trim().min(1).optional(),
    order_id: z.string().trim().min(1).optional(),
    orderAction: z.string().trim().min(1).optional(),
    webUrl: z.string().trim().url().optional(),
    web_url: z.string().trim().url().optional(),
    deeplinkUrl: z.string().trim().url().optional(),
    deeplink_url: z.string().trim().url().optional(),
  }).optional(),
});

const readBooleanEnv = (value: string | undefined) =>
  ['true', '1', 'yes', 'on'].includes(value?.trim().toLowerCase() ?? '');

const waffoProductSchema = z.object({
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

const normalizeWaffoProduct = (input: unknown): WaffoTopUpProduct | null => {
  const parsed = waffoProductSchema.safeParse(input);

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

export const parseWaffoProducts = (rawProducts = '[]') => {
  try {
    const parsed = JSON.parse(rawProducts);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map(normalizeWaffoProduct)
      .filter((product): product is WaffoTopUpProduct => Boolean(product));
  } catch {
    return [];
  }
};

export const getWaffoTopUpConfig = (): WaffoTopUpConfig => {
  const products = parseWaffoProducts(process.env.WAFFO_PRODUCTS);
  const configured = Boolean(
    process.env.WAFFO_API_KEY?.trim() &&
    process.env.WAFFO_PRIVATE_KEY?.trim() &&
    process.env.APP_BASE_URL?.trim() &&
    products.length > 0,
  );

  return {
    enabled: readBooleanEnv(process.env.WAFFO_TOPUP_ENABLED) && configured,
    configured,
    webhookConfigured: Boolean(process.env.WAFFO_PUBLIC_KEY?.trim()),
    testMode: readBooleanEnv(process.env.WAFFO_TEST_MODE),
    products,
  };
};

const getWaffoApiBaseUrl = (testMode: boolean) =>
  testMode ? 'https://sandbox-api.waffo.com' : 'https://api.waffo.com';

const readWaffoErrorMessage = (payload: unknown) => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const message = (payload as { msg?: unknown; message?: unknown }).msg ??
    (payload as { message?: unknown }).message;

  return typeof message === 'string' && message.trim() ? message.trim() : null;
};

const readWaffoCheckoutUrl = (data: z.infer<typeof waffoCheckoutResponseSchema>['data']) =>
  data?.webUrl ?? data?.web_url ?? data?.deeplinkUrl ?? data?.deeplink_url ?? data?.orderAction;

const signWaffoPayload = (payload: string, privateKey: string) => {
  const trimmedPrivateKey = privateKey.trim();
  const key = trimmedPrivateKey.includes('BEGIN')
    ? trimmedPrivateKey
    : createPrivateKey({
      key: Buffer.from(trimmedPrivateKey.replaceAll(/\s/g, ''), 'base64'),
      format: 'der',
      type: 'pkcs8',
    });
  const signer = createSign('RSA-SHA256');

  signer.update(payload);
  signer.end();

  return signer.sign(key, 'base64');
};

const readWaffoPublicKey = (publicKey: string) => {
  const trimmedPublicKey = publicKey.trim();

  return trimmedPublicKey.includes('BEGIN')
    ? trimmedPublicKey
    : createPublicKey({
      key: Buffer.from(trimmedPublicKey.replaceAll(/\s/g, ''), 'base64'),
      format: 'der',
      type: 'spki',
    });
};

export const verifyWaffoWebhookSignature = (payload: string, signature: string, publicKey: string) => {
  const key = readWaffoPublicKey(publicKey);
  const trimmedSignature = signature.trim();

  for (const encoding of ['base64', 'hex'] as const) {
    const verifier = createVerify('RSA-SHA256');
    verifier.update(payload);
    verifier.end();

    if (verifier.verify(key, trimmedSignature, encoding)) {
      return;
    }
  }

  throw new Error('Waffo webhook signature is invalid');
};

export const createWaffoCheckoutSession = async (input: {
  apiKey: string;
  privateKey: string;
  product: WaffoTopUpProduct;
  requestId: string;
  userId: string;
  userEmail: string;
  successUrl: string;
  notifyUrl: string;
  testMode: boolean;
}) => {
  const payload = {
    paymentRequestId: input.requestId,
    merchantOrderId: input.requestId,
    orderAmount: (input.product.amountCents / 100).toFixed(2),
    orderCurrency: input.product.currency.toUpperCase(),
    orderDescription: input.product.name,
    orderRequestedAt: new Date().toISOString(),
    notifyUrl: input.notifyUrl,
    userInfo: {
      userId: input.userId,
      userEmail: input.userEmail,
      userTerminal: 'WEB',
    },
    paymentInfo: {
      productName: 'ONE_TIME_PAYMENT',
    },
    successRedirectUrl: input.successUrl,
    failedRedirectUrl: input.successUrl,
    metadata: {
      provider: 'waffo',
      productId: input.product.productId,
      quotaAmount: String(input.product.quotaAmount),
      amountCents: String(input.product.amountCents),
    },
  };
  const body = JSON.stringify(payload);
  const signature = signWaffoPayload(body, input.privateKey);
  const response = await fetch(`${getWaffoApiBaseUrl(input.testMode)}/v1/order/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': input.apiKey,
      'X-SIGNATURE': signature,
    },
    body,
  });
  const json = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(readWaffoErrorMessage(json) ?? 'Failed to create Waffo checkout session');
  }

  const parsed = waffoCheckoutResponseSchema.safeParse(json);

  if (!parsed.success) {
    throw new Error('Failed to create Waffo checkout session');
  }

  const code = parsed.data.code;
  const successCode = code === undefined || code === 0 || code === '0' || code === 200 || code === '200' || code === 'SUCCESS';

  if (!successCode || !parsed.data.data) {
    throw new Error(readWaffoErrorMessage(parsed.data) ?? 'Failed to create Waffo checkout session');
  }

  const checkoutUrl = readWaffoCheckoutUrl(parsed.data.data);

  if (!checkoutUrl) {
    throw new Error('Failed to create Waffo checkout session');
  }

  return {
    id: parsed.data.data.id ?? input.requestId,
    orderId: parsed.data.data.orderId ?? parsed.data.data.order_id ?? input.requestId,
    url: checkoutUrl,
  };
};
