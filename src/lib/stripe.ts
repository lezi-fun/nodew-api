import { createHmac, timingSafeEqual } from 'node:crypto';

export const stripeApiVersion = '2026-02-25.clover';

export type StripeTopUpConfig = {
  enabled: boolean;
  configured: boolean;
  currency: string;
  quotaPerUnit: number;
  unitAmountCents: number;
  minUnits: number;
};

const readBooleanEnv = (value: string | undefined) =>
  ['true', '1', 'yes', 'on'].includes(value?.trim().toLowerCase() ?? '');

export const getStripeTopUpConfig = (): StripeTopUpConfig => {
  const configured = Boolean(process.env.STRIPE_SECRET_KEY?.trim() && process.env.APP_BASE_URL?.trim());

  return {
    enabled: readBooleanEnv(process.env.STRIPE_TOPUP_ENABLED) && configured,
    configured,
    currency: (process.env.STRIPE_CURRENCY ?? 'usd').trim().toLowerCase(),
    quotaPerUnit: Math.max(1, Number(process.env.STRIPE_QUOTA_PER_UNIT ?? 100000)),
    unitAmountCents: Math.max(1, Number(process.env.STRIPE_UNIT_AMOUNT_CENTS ?? 100)),
    minUnits: Math.max(1, Number(process.env.STRIPE_MIN_UNITS ?? 1)),
  };
};

const readStripeErrorMessage = (payload: unknown) => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const error = (payload as { error?: unknown }).error;

  if (!error || typeof error !== 'object') {
    return null;
  }

  const message = (error as { message?: unknown }).message;
  return typeof message === 'string' && message.trim() ? message.trim() : null;
};

export const createStripeCheckoutSession = async (input: {
  secretKey: string;
  orderId: string;
  userId: string;
  userEmail: string;
  quotaAmount: bigint;
  units: number;
  unitAmountCents: number;
  currency: string;
  successUrl: string;
  cancelUrl: string;
}) => {
  const body = new URLSearchParams();
  body.set('mode', 'payment');
  body.set('client_reference_id', input.orderId);
  body.set('customer_email', input.userEmail);
  body.set('success_url', input.successUrl);
  body.set('cancel_url', input.cancelUrl);
  body.set('metadata[orderId]', input.orderId);
  body.set('metadata[userId]', input.userId);
  body.set('metadata[quotaAmount]', input.quotaAmount.toString());
  body.set('line_items[0][quantity]', String(input.units));
  body.set('line_items[0][price_data][currency]', input.currency);
  body.set('line_items[0][price_data][unit_amount]', String(input.unitAmountCents));
  body.set('line_items[0][price_data][product_data][name]', 'Quota top-up');
  body.set('line_items[0][price_data][product_data][description]', `${input.quotaAmount.toString()} quota`);

  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Stripe-Version': stripeApiVersion,
    },
    body: body.toString(),
  });
  const json = await response.json().catch(() => null) as {
    id?: string;
    url?: string;
    payment_intent?: string | null;
  } | null;

  if (!response.ok || !json?.id || !json.url) {
    throw new Error(readStripeErrorMessage(json) ?? 'Failed to create Stripe checkout session');
  }

  return {
    id: json.id,
    url: json.url,
    paymentIntentId: typeof json.payment_intent === 'string' ? json.payment_intent : null,
  };
};

const parseStripeSignatureHeader = (header: string) => {
  const values = new Map<string, string[]>();

  for (const part of header.split(',')) {
    const [key, value] = part.split('=');

    if (!key || !value) {
      continue;
    }

    const list = values.get(key) ?? [];
    list.push(value);
    values.set(key, list);
  }

  return values;
};

const safeEqualHex = (left: string, right: string) => {
  const leftBuffer = Buffer.from(left, 'hex');
  const rightBuffer = Buffer.from(right, 'hex');

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
};

export const verifyStripeWebhookSignature = (payload: string, signatureHeader: string, secret: string, toleranceSeconds = 300) => {
  const parsed = parseStripeSignatureHeader(signatureHeader);
  const timestamp = parsed.get('t')?.[0];
  const signatures = parsed.get('v1') ?? [];

  if (!timestamp || signatures.length === 0) {
    throw new Error('Stripe webhook signature is invalid');
  }

  const timestampSeconds = Number(timestamp);

  if (!Number.isFinite(timestampSeconds)) {
    throw new Error('Stripe webhook timestamp is invalid');
  }

  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - timestampSeconds);

  if (ageSeconds > toleranceSeconds) {
    throw new Error('Stripe webhook signature has expired');
  }

  const expected = createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
  const valid = signatures.some((signature) => safeEqualHex(signature, expected));

  if (!valid) {
    throw new Error('Stripe webhook signature is invalid');
  }
};
