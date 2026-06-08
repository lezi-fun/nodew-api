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
