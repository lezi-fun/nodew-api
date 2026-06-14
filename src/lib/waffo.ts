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
    process.env.APP_BASE_URL?.trim() &&
    products.length > 0,
  );

  return {
    enabled: readBooleanEnv(process.env.WAFFO_TOPUP_ENABLED) && configured,
    configured,
    webhookConfigured: Boolean(process.env.WAFFO_WEBHOOK_SECRET?.trim()),
    testMode: readBooleanEnv(process.env.WAFFO_TEST_MODE),
    products,
  };
};
