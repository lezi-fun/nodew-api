import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';

import {
  createCreemCheckoutSession,
  verifyCreemWebhookSignature,
} from '../../lib/creem.js';
import { prisma } from '../../lib/prisma.js';
import { getPaymentConfiguration } from '../../lib/payment-config.js';
import { appendUserSubscription } from '../../lib/user-subscriptions.js';
import {
  createStripeCheckoutSession,
  verifyStripeWebhookSignature,
} from '../../lib/stripe.js';
import {
  createWaffoCheckoutSession,
  verifyWaffoWebhookSignature,
} from '../../lib/waffo.js';

type RawBodyRequest = FastifyRequest & {
  rawBody?: string;
};

type StripeCheckoutSessionObject = {
  id?: string;
  payment_status?: string;
  payment_intent?: string | null;
  metadata?: {
    orderId?: string;
    userId?: string;
    quotaAmount?: string;
  } | null;
};

type StripeWebhookEvent = {
  id?: string;
  type?: string;
  data?: {
    object?: StripeCheckoutSessionObject;
  };
};

type CreemWebhookEvent = {
  id?: string;
  eventType?: string;
  object?: {
    request_id?: string;
    order?: {
      id?: string;
      amount_paid?: number;
      currency?: string;
      status?: string;
      type?: string;
    };
    product?: {
      id?: string;
      name?: string;
    };
  };
};

type WaffoWebhookEvent = {
  eventType?: string;
  result?: Record<string, unknown>;
  data?: Record<string, unknown>;
  object?: Record<string, unknown>;
};

const stripeCheckoutBodySchema = z.object({
  units: z.coerce.number().int().positive().max(100000),
});

const creemCheckoutBodySchema = z.object({
  productId: z.string().trim().min(1).max(255),
});

const waffoCheckoutBodySchema = z.object({
  productId: z.string().trim().min(1).max(255),
});

const buildAppUrl = (path: string, configuredAppBaseUrl?: string) => {
  const appBaseUrl = configuredAppBaseUrl?.trim() || process.env.APP_BASE_URL?.trim();

  if (!appBaseUrl) {
    throw new Error('APP_BASE_URL is required for Stripe top-up');
  }

  const url = new URL(path, appBaseUrl);
  return url.toString();
};

const topUpOrderSelect = {
  id: true,
  status: true,
  quotaAmount: true,
  amountCents: true,
  currency: true,
  stripeSessionId: true,
  paidAt: true,
  createdAt: true,
} as const;

const serializeOrder = (order: {
  id: string;
  status: string;
  quotaAmount: bigint;
  amountCents: number;
  currency: string;
  stripeSessionId: string | null;
  paidAt: Date | null;
  createdAt: Date;
}) => ({
  ...order,
  quotaAmount: order.quotaAmount.toString(),
  paidAt: order.paidAt?.toISOString() ?? null,
  createdAt: order.createdAt.toISOString(),
});

const creemWebhookTerminalErrors = new Set([
  'Creem event does not reference a top-up order',
  'Creem top-up order not found',
  'Creem top-up order is not pending',
  'Creem top-up amount does not match the pending order',
  'Creem top-up currency does not match the pending order',
  'Creem top-up product does not match the pending order',
]);

const isCreemWebhookTerminalError = (error: unknown): error is Error =>
  error instanceof Error && creemWebhookTerminalErrors.has(error.message);

const waffoWebhookTerminalErrors = new Set([
  'Waffo event does not reference a top-up order',
  'Waffo top-up order not found',
  'Waffo top-up order is not pending',
  'Waffo top-up amount does not match the pending order',
  'Waffo top-up currency does not match the pending order',
  'Waffo top-up product does not match the pending order',
]);

const isWaffoWebhookTerminalError = (error: unknown): error is Error =>
  error instanceof Error && waffoWebhookTerminalErrors.has(error.message);

const billingRawBodyRoutes = new Set([
  '/api/user/topup/stripe/webhook',
  '/api/user/topup/creem/webhook',
  '/api/user/topup/waffo/webhook',
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

const readOrderKind = (metadata: unknown) =>
  isRecord(metadata) && typeof metadata.kind === 'string' ? metadata.kind : 'topup';

const readStringField = (record: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return null;
};

const readWaffoPaymentResult = (event: WaffoWebhookEvent) => {
  const candidate = event.result ?? event.data ?? event.object;
  return isRecord(candidate) ? candidate : null;
};

const readWaffoAmountCents = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.round(value * 100);
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.round(parsed * 100) : undefined;
  }

  return undefined;
};

const getWaffoOrderSelectors = (result: Record<string, unknown>) => {
  const merchantOrderId = readStringField(result, ['merchantOrderId', 'merchantOrderID', 'merchant_order_id']);
  const paymentRequestId = readStringField(result, ['paymentRequestId', 'paymentRequestID', 'payment_request_id']);
  const orderId = readStringField(result, ['orderId', 'orderID', 'order_id']);
  const selectors = [
    ...(merchantOrderId ? [{ id: merchantOrderId }] : []),
    ...(paymentRequestId ? [{ id: paymentRequestId }] : []),
    ...(orderId ? [{ waffoOrderId: orderId }, { waffoCheckoutId: orderId }] : []),
  ];

  return {
    merchantOrderId,
    paymentRequestId,
    orderId,
    selectors,
  };
};

const waffoPaidStatuses = new Set(['PAY_SUCCESS', 'SUCCESS', 'PAID']);

const settleStripeOrder = async (session: StripeCheckoutSessionObject) => {
  const orderId = session.metadata?.orderId?.trim();
  const sessionId = session.id?.trim();

  if (!orderId && !sessionId) {
    throw new Error('Stripe session does not reference a top-up order');
  }

  return prisma.$transaction(async (tx) => {
    const order = await tx.topUpOrder.findFirst({
      where: {
        OR: [
          ...(orderId ? [{ id: orderId }] : []),
          ...(sessionId ? [{ stripeSessionId: sessionId }] : []),
        ],
      },
      select: {
        id: true,
        userId: true,
        status: true,
        quotaAmount: true,
        amountCents: true,
        currency: true,
        metadata: true,
      },
    });

    if (!order) {
      throw new Error('Stripe top-up order not found');
    }

    if (order.status === 'PAID') {
      return { settled: false, orderId: order.id };
    }

    if (order.status !== 'PENDING') {
      throw new Error('Stripe top-up order is not pending');
    }

    const updated = await tx.topUpOrder.updateMany({
      where: {
        id: order.id,
        status: 'PENDING',
      },
      data: {
        status: 'PAID',
        stripePaymentIntentId: session.payment_intent ?? undefined,
        paidAt: new Date(),
      },
    });

    if (updated.count === 0) {
      return { settled: false, orderId: order.id };
    }

    if (readOrderKind(order.metadata) === 'subscription') {
      const now = new Date();
      const metadata = isRecord(order.metadata) ? order.metadata : {};
      const durationDays = typeof metadata.durationDays === 'number' && Number.isFinite(metadata.durationDays)
        ? Math.max(0, Math.trunc(metadata.durationDays))
        : 0;
      const endAt = durationDays > 0
        ? new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000).toISOString()
        : null;
      const user = await tx.user.findUnique({
        where: { id: order.userId },
        select: { settings: true },
      });

      await tx.user.update({
        where: { id: order.userId },
        data: {
          quotaRemaining: order.quotaAmount > 0n ? { increment: order.quotaAmount } : undefined,
          settings: appendUserSubscription(user?.settings, {
            id: order.id,
            planId: typeof metadata.planId === 'string' ? metadata.planId : order.id,
            title: typeof metadata.planTitle === 'string' ? metadata.planTitle : 'Subscription',
            subtitle: typeof metadata.planSubtitle === 'string' ? metadata.planSubtitle : '',
            badge: typeof metadata.badge === 'string' ? metadata.badge : '',
            description: typeof metadata.description === 'string' ? metadata.description : '',
            quota: typeof metadata.quota === 'string' ? metadata.quota : '',
            quotaAmount: order.quotaAmount.toString(),
            duration: typeof metadata.duration === 'string' ? metadata.duration : '',
            durationDays,
            features: Array.isArray(metadata.features)
              ? metadata.features.filter((item): item is string => typeof item === 'string')
              : [],
            provider: 'STRIPE',
            amountCents: order.amountCents,
            currency: order.currency,
            status: 'ACTIVE',
            startAt: now.toISOString(),
            endAt,
            createdAt: now.toISOString(),
          }),
        },
      });
    } else {
      await tx.user.update({
        where: { id: order.userId },
        data: {
          quotaRemaining: { increment: order.quotaAmount },
        },
      });
    }

    return { settled: true, orderId: order.id };
  });
};

const settleCreemOrder = async (event: CreemWebhookEvent) => {
  const requestId = event.object?.request_id?.trim();
  const orderId = event.object?.order?.id?.trim();
  const paidAmount = event.object?.order?.amount_paid;
  const paidCurrency = event.object?.order?.currency?.trim().toLowerCase();
  const productId = event.object?.product?.id?.trim();

  if (!requestId && !orderId) {
    throw new Error('Creem event does not reference a top-up order');
  }

  return prisma.$transaction(async (tx) => {
    const order = await tx.topUpOrder.findFirst({
      where: {
        provider: 'CREEM',
        OR: [
          ...(requestId ? [{ id: requestId }, { creemRequestId: requestId }] : []),
          ...(orderId ? [{ creemOrderId: orderId }] : []),
        ],
      },
      select: {
        id: true,
        userId: true,
        status: true,
        quotaAmount: true,
        amountCents: true,
        currency: true,
        creemProductId: true,
      },
    });

    if (!order) {
      throw new Error('Creem top-up order not found');
    }

    if (order.status === 'PAID') {
      return { settled: false, orderId: order.id };
    }

    if (order.status !== 'PENDING') {
      throw new Error('Creem top-up order is not pending');
    }

    if (typeof paidAmount === 'number' && paidAmount !== order.amountCents) {
      throw new Error('Creem top-up amount does not match the pending order');
    }

    if (paidCurrency && paidCurrency !== order.currency.toLowerCase()) {
      throw new Error('Creem top-up currency does not match the pending order');
    }

    if (productId && order.creemProductId && productId !== order.creemProductId) {
      throw new Error('Creem top-up product does not match the pending order');
    }

    const updated = await tx.topUpOrder.updateMany({
      where: {
        id: order.id,
        status: 'PENDING',
      },
      data: {
        status: 'PAID',
        creemOrderId: orderId ?? undefined,
        paidAt: new Date(),
      },
    });

    if (updated.count === 0) {
      return { settled: false, orderId: order.id };
    }

    await tx.user.update({
      where: { id: order.userId },
      data: {
        quotaRemaining: { increment: order.quotaAmount },
      },
    });

    return { settled: true, orderId: order.id };
  });
};

const failWaffoOrder = async (result: Record<string, unknown>) => {
  const { selectors, merchantOrderId, paymentRequestId, orderId } = getWaffoOrderSelectors(result);

  if (selectors.length === 0) {
    return {
      failed: false,
      orderId: null,
    };
  }

  const updated = await prisma.topUpOrder.updateMany({
    where: {
      provider: 'WAFFO',
      status: 'PENDING',
      OR: selectors,
    },
    data: {
      status: 'FAILED',
    },
  });

  return {
    failed: updated.count > 0,
    orderId: merchantOrderId ?? paymentRequestId ?? orderId ?? null,
  };
};

const settleWaffoOrder = async (result: Record<string, unknown>) => {
  const { selectors, orderId } = getWaffoOrderSelectors(result);
  const paidAmountCents = readWaffoAmountCents(result.orderAmount ?? result.amount ?? result.paymentAmount);
  const paidCurrency = readStringField(result, ['orderCurrency', 'currency'])?.toLowerCase();
  const productId = readStringField(result, ['productId', 'product_id']);

  if (selectors.length === 0) {
    throw new Error('Waffo event does not reference a top-up order');
  }

  return prisma.$transaction(async (tx) => {
    const order = await tx.topUpOrder.findFirst({
      where: {
        provider: 'WAFFO',
        OR: selectors,
      },
      select: {
        id: true,
        userId: true,
        status: true,
        quotaAmount: true,
        amountCents: true,
        currency: true,
        waffoProductId: true,
      },
    });

    if (!order) {
      throw new Error('Waffo top-up order not found');
    }

    if (order.status === 'PAID') {
      return { settled: false, orderId: order.id };
    }

    if (order.status !== 'PENDING') {
      throw new Error('Waffo top-up order is not pending');
    }

    if (paidAmountCents !== undefined && paidAmountCents !== order.amountCents) {
      throw new Error('Waffo top-up amount does not match the pending order');
    }

    if (paidCurrency && paidCurrency !== order.currency.toLowerCase()) {
      throw new Error('Waffo top-up currency does not match the pending order');
    }

    if (productId && order.waffoProductId && productId !== order.waffoProductId) {
      throw new Error('Waffo top-up product does not match the pending order');
    }

    const updated = await tx.topUpOrder.updateMany({
      where: {
        id: order.id,
        status: 'PENDING',
      },
      data: {
        status: 'PAID',
        waffoOrderId: orderId ?? undefined,
        paidAt: new Date(),
      },
    });

    if (updated.count === 0) {
      return { settled: false, orderId: order.id };
    }

    await tx.user.update({
      where: { id: order.userId },
      data: {
        quotaRemaining: { increment: order.quotaAmount },
      },
    });

    return { settled: true, orderId: order.id };
  });
};

const billingRoutes: FastifyPluginAsync = async (app) => {
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (request, body, done) => {
    const rawJsonBody = typeof body === 'string' ? body : body.toString('utf8');

    if (request.method === 'POST' && billingRawBodyRoutes.has(request.url.split('?')[0] ?? '')) {
      done(null, rawJsonBody);
      return;
    }

    try {
      done(null, rawJsonBody.trim() ? JSON.parse(rawJsonBody) : {});
    } catch {
      done(app.httpErrors.badRequest("Body is not valid JSON but content-type is set to 'application/json'"));
    }
  });

  app.get('/user/topup/stripe/config', {
    preHandler: app.requireUser,
  }, async () => {
    const configuration = await getPaymentConfiguration();
    const stripe = configuration.runtime.stripe;

    return {
      item: {
        enabled: stripe.enabled,
        configured: stripe.configured,
        currency: stripe.currency,
        quotaPerUnit: stripe.quotaPerUnit,
        unitAmountCents: stripe.unitAmountCents,
        minUnits: stripe.minUnits,
      },
    };
  });

  app.get('/user/topup/creem/config', {
    preHandler: app.requireUser,
  }, async () => {
    const { creem } = (await getPaymentConfiguration()).runtime;
    return { item: {
      enabled: creem.enabled,
      configured: creem.configured,
      webhookConfigured: creem.webhookConfigured,
      testMode: creem.testMode,
      products: creem.products,
    } };
  });

  app.get('/user/topup/waffo/config', {
    preHandler: app.requireUser,
  }, async () => {
    const { waffo } = (await getPaymentConfiguration()).runtime;
    return { item: {
      enabled: waffo.enabled,
      configured: waffo.configured,
      webhookConfigured: waffo.webhookConfigured,
      testMode: waffo.testMode,
      products: waffo.products,
    } };
  });

  app.post('/user/topup/creem/checkout', {
    preHandler: app.requireUser,
  }, async (request) => {
    const body = creemCheckoutBodySchema.parse(request.body);
    const paymentConfiguration = await getPaymentConfiguration();
    const config = paymentConfiguration.runtime.creem;
    const apiKey = config.apiKey;

    if (!config.enabled || !apiKey) {
      throw app.httpErrors.badRequest('Creem top-up is not configured');
    }

    const product = config.products.find((item) => item.productId === body.productId);

    if (!product) {
      throw app.httpErrors.badRequest('Creem product is not configured');
    }

    const quotaAmount = BigInt(product.quotaAmount);
    const order = await prisma.topUpOrder.create({
      data: {
        userId: request.currentUser!.id,
        provider: 'CREEM',
        status: 'PENDING',
        quotaAmount,
        amountCents: product.amountCents,
        currency: product.currency,
        creemProductId: product.productId,
        metadata: {
          productId: product.productId,
          productName: product.name,
          quantity: 1,
        },
      },
      select: topUpOrderSelect,
    });
    const successUrl = buildAppUrl(`/console/topup?creem=success&order=${order.id}`, paymentConfiguration.runtime.appBaseUrl);
    const session = await createCreemCheckoutSession({
      apiKey,
      product,
      requestId: order.id,
      userId: request.currentUser!.id,
      userEmail: request.currentUser!.email,
      successUrl,
      testMode: config.testMode,
    });
    const updatedOrder = await prisma.topUpOrder.update({
      where: { id: order.id },
      data: {
        creemCheckoutId: session.id,
        creemRequestId: session.requestId,
        creemOrderId: session.orderId ?? undefined,
      },
      select: topUpOrderSelect,
    });

    return {
      success: true,
      checkoutUrl: session.url,
      order: serializeOrder(updatedOrder),
    };
  });

  app.post('/user/topup/waffo/checkout', {
    preHandler: app.requireUser,
  }, async (request) => {
    const body = waffoCheckoutBodySchema.parse(request.body);
    const paymentConfiguration = await getPaymentConfiguration();
    const config = paymentConfiguration.runtime.waffo;
    const apiKey = config.apiKey;
    const privateKey = config.privateKey;

    if (!config.enabled || !apiKey || !privateKey) {
      throw app.httpErrors.badRequest('Waffo top-up is not configured');
    }

    const product = config.products.find((item) => item.productId === body.productId);

    if (!product) {
      throw app.httpErrors.badRequest('Waffo product is not configured');
    }

    const quotaAmount = BigInt(product.quotaAmount);
    const order = await prisma.topUpOrder.create({
      data: {
        userId: request.currentUser!.id,
        provider: 'WAFFO',
        status: 'PENDING',
        quotaAmount,
        amountCents: product.amountCents,
        currency: product.currency,
        waffoProductId: product.productId,
        metadata: {
          productId: product.productId,
          productName: product.name,
          quantity: 1,
        },
      },
      select: topUpOrderSelect,
    });
    const successUrl = buildAppUrl(`/console/topup?waffo=success&order=${order.id}`, paymentConfiguration.runtime.appBaseUrl);
    const notifyUrl = buildAppUrl('/api/user/topup/waffo/webhook', paymentConfiguration.runtime.appBaseUrl);
    const session = await createWaffoCheckoutSession({
      apiKey,
      privateKey,
      product,
      requestId: order.id,
      userId: request.currentUser!.id,
      userEmail: request.currentUser!.email,
      successUrl,
      notifyUrl,
      testMode: config.testMode,
    });
    const updatedOrder = await prisma.topUpOrder.update({
      where: { id: order.id },
      data: {
        waffoCheckoutId: session.id,
        waffoOrderId: session.orderId,
      },
      select: topUpOrderSelect,
    });

    return {
      success: true,
      checkoutUrl: session.url,
      order: serializeOrder(updatedOrder),
    };
  });

  app.post('/user/topup/stripe/checkout', {
    preHandler: app.requireUser,
  }, async (request) => {
    const body = stripeCheckoutBodySchema.parse(request.body);
    const paymentConfiguration = await getPaymentConfiguration();
    const config = paymentConfiguration.runtime.stripe;
    const secretKey = config.secretKey;

    if (!config.enabled || !secretKey) {
      throw app.httpErrors.badRequest('Stripe top-up is not configured');
    }

    if (body.units < config.minUnits) {
      throw app.httpErrors.badRequest(`Stripe top-up requires at least ${config.minUnits} unit(s)`);
    }

    const quotaAmount = BigInt(body.units) * BigInt(config.quotaPerUnit);
    const amountCents = body.units * config.unitAmountCents;
    const order = await prisma.topUpOrder.create({
      data: {
        userId: request.currentUser!.id,
        provider: 'STRIPE',
        status: 'PENDING',
        quotaAmount,
        amountCents,
        currency: config.currency,
        metadata: {
          units: body.units,
          quotaPerUnit: config.quotaPerUnit,
          unitAmountCents: config.unitAmountCents,
        },
      },
      select: topUpOrderSelect,
    });
    const successUrl = buildAppUrl(`/console/topup?stripe=success&order=${order.id}`, paymentConfiguration.runtime.appBaseUrl);
    const cancelUrl = buildAppUrl(`/console/topup?stripe=cancel&order=${order.id}`, paymentConfiguration.runtime.appBaseUrl);
    const session = await createStripeCheckoutSession({
      secretKey,
      orderId: order.id,
      userId: request.currentUser!.id,
      userEmail: request.currentUser!.email,
      quotaAmount,
      units: body.units,
      unitAmountCents: config.unitAmountCents,
      currency: config.currency,
      successUrl,
      cancelUrl,
    });
    const updatedOrder = await prisma.topUpOrder.update({
      where: { id: order.id },
      data: {
        stripeSessionId: session.id,
        stripePaymentIntentId: session.paymentIntentId,
      },
      select: topUpOrderSelect,
    });

    return {
      success: true,
      checkoutUrl: session.url,
      order: serializeOrder(updatedOrder),
    };
  });

  app.post('/user/topup/creem/webhook', async (request) => {
    const rawBody = (request as RawBodyRequest).rawBody;

    if (!rawBody) {
      throw app.httpErrors.badRequest('Creem webhook body is missing');
    }

    const webhookSecret = (await getPaymentConfiguration()).runtime.creem.webhookSecret;

    if (!webhookSecret) {
      throw app.httpErrors.badRequest('Creem webhook secret is not configured');
    }

    const signature = request.headers['creem-signature'];

    if (typeof signature !== 'string') {
      throw app.httpErrors.badRequest('Creem webhook signature is missing');
    }

    try {
      verifyCreemWebhookSignature(rawBody, signature, webhookSecret);
    } catch (error) {
      throw app.httpErrors.badRequest(error instanceof Error ? error.message : 'Creem webhook signature is invalid');
    }

    let event: CreemWebhookEvent;

    try {
      event = JSON.parse(rawBody) as CreemWebhookEvent;
    } catch {
      throw app.httpErrors.badRequest('Creem webhook body must be valid JSON');
    }

    if (!event.eventType || !event.object) {
      throw app.httpErrors.badRequest('Creem webhook event is invalid');
    }

    if (event.eventType !== 'checkout.completed') {
      return {
        success: true,
        ignored: true,
      };
    }

    if (event.object.order?.status !== 'paid') {
      return {
        success: true,
        ignored: true,
        reason: 'order_not_paid',
      };
    }

    if (event.object.order?.type && event.object.order.type !== 'onetime') {
      return {
        success: true,
        ignored: true,
        reason: 'unsupported_order_type',
      };
    }

    let result: Awaited<ReturnType<typeof settleCreemOrder>>;

    try {
      result = await settleCreemOrder(event);
    } catch (error) {
      if (isCreemWebhookTerminalError(error)) {
        throw app.httpErrors.badRequest(error.message);
      }

      throw error;
    }

    return {
      success: true,
      ...result,
    };
  });

  app.post('/user/topup/waffo/webhook', async (request) => {
    const rawBody = (request as RawBodyRequest).rawBody;

    if (!rawBody) {
      throw app.httpErrors.badRequest('Waffo webhook body is missing');
    }

    const publicKey = (await getPaymentConfiguration()).runtime.waffo.publicKey;

    if (!publicKey) {
      throw app.httpErrors.badRequest('Waffo webhook public key is not configured');
    }

    const signature = request.headers['x-signature'];

    if (typeof signature !== 'string') {
      throw app.httpErrors.badRequest('Waffo webhook signature is missing');
    }

    try {
      verifyWaffoWebhookSignature(rawBody, signature, publicKey);
    } catch (error) {
      throw app.httpErrors.badRequest(error instanceof Error ? error.message : 'Waffo webhook signature is invalid');
    }

    let event: WaffoWebhookEvent;

    try {
      event = JSON.parse(rawBody) as WaffoWebhookEvent;
    } catch {
      throw app.httpErrors.badRequest('Waffo webhook body must be valid JSON');
    }

    const result = readWaffoPaymentResult(event);

    if (!event.eventType && !result) {
      throw app.httpErrors.badRequest('Waffo webhook event is invalid');
    }

    if (!result) {
      return {
        success: true,
        ignored: true,
      };
    }

    const orderStatus = readStringField(result, ['orderStatus', 'order_status', 'status']);

    if (!orderStatus || !waffoPaidStatuses.has(orderStatus)) {
      const failed = await failWaffoOrder(result);

      return {
        success: true,
        ignored: true,
        reason: 'order_not_paid',
        ...failed,
      };
    }

    let settleResult: Awaited<ReturnType<typeof settleWaffoOrder>>;

    try {
      settleResult = await settleWaffoOrder(result);
    } catch (error) {
      if (isWaffoWebhookTerminalError(error)) {
        throw app.httpErrors.badRequest(error.message);
      }

      throw error;
    }

    return {
      success: true,
      ...settleResult,
    };
  });

  app.post('/user/topup/stripe/webhook', async (request) => {
    const rawBody = (request as RawBodyRequest).rawBody;

    if (!rawBody) {
      throw app.httpErrors.badRequest('Stripe webhook body is missing');
    }

    const webhookSecret = (await getPaymentConfiguration()).runtime.stripe.webhookSecret;

    if (!webhookSecret) {
      throw app.httpErrors.badRequest('Stripe webhook secret is not configured');
    }

    const signature = request.headers['stripe-signature'];

    if (typeof signature !== 'string') {
      throw app.httpErrors.badRequest('Stripe webhook signature is missing');
    }

    try {
      verifyStripeWebhookSignature(rawBody, signature, webhookSecret);
    } catch (error) {
      throw app.httpErrors.badRequest(error instanceof Error ? error.message : 'Stripe webhook signature is invalid');
    }

    const event = JSON.parse(rawBody) as StripeWebhookEvent;
    const session = event.data?.object;

    if (!event.type || !session) {
      throw app.httpErrors.badRequest('Stripe webhook event is invalid');
    }

    if (event.type === 'checkout.session.completed') {
      if (session.payment_status !== 'paid') {
        return {
          success: true,
          ignored: true,
          reason: 'payment_not_paid',
        };
      }

      const result = await settleStripeOrder(session);
      return {
        success: true,
        ...result,
      };
    }

    if (event.type === 'checkout.session.async_payment_succeeded') {
      const result = await settleStripeOrder(session);
      return {
        success: true,
        ...result,
      };
    }

    if (event.type === 'checkout.session.expired' && session.id) {
      await prisma.topUpOrder.updateMany({
        where: {
          stripeSessionId: session.id,
          status: 'PENDING',
        },
        data: {
          status: 'EXPIRED',
        },
      });
    }

    if (event.type === 'checkout.session.async_payment_failed' && session.id) {
      await prisma.topUpOrder.updateMany({
        where: {
          stripeSessionId: session.id,
          status: 'PENDING',
        },
        data: {
          status: 'FAILED',
        },
      });
    }

    return {
      success: true,
      ignored: true,
    };
  });
};

export default billingRoutes;
