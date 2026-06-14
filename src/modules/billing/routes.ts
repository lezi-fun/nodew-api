import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';

import {
  createCreemCheckoutSession,
  getCreemTopUpConfig,
  verifyCreemWebhookSignature,
} from '../../lib/creem.js';
import { prisma } from '../../lib/prisma.js';
import {
  createStripeCheckoutSession,
  getStripeTopUpConfig,
  verifyStripeWebhookSignature,
} from '../../lib/stripe.js';
import { getWaffoTopUpConfig } from '../../lib/waffo.js';

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

const stripeCheckoutBodySchema = z.object({
  units: z.coerce.number().int().positive().max(100000),
});

const creemCheckoutBodySchema = z.object({
  productId: z.string().trim().min(1).max(255),
});

const buildAppUrl = (path: string) => {
  const appBaseUrl = process.env.APP_BASE_URL?.trim();

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

const billingRawBodyRoutes = new Set([
  '/api/user/topup/stripe/webhook',
  '/api/user/topup/creem/webhook',
]);

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

    await tx.user.update({
      where: { id: order.userId },
      data: {
        quotaRemaining: { increment: order.quotaAmount },
      },
    });

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
  }, async () => ({
    item: getStripeTopUpConfig(),
  }));

  app.get('/user/topup/creem/config', {
    preHandler: app.requireUser,
  }, async () => ({
    item: getCreemTopUpConfig(),
  }));

  app.get('/user/topup/waffo/config', {
    preHandler: app.requireUser,
  }, async () => ({
    item: getWaffoTopUpConfig(),
  }));

  app.post('/user/topup/creem/checkout', {
    preHandler: app.requireUser,
  }, async (request) => {
    const body = creemCheckoutBodySchema.parse(request.body);
    const config = getCreemTopUpConfig();
    const apiKey = process.env.CREEM_API_KEY?.trim();

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
    const successUrl = buildAppUrl(`/console/topup?creem=success&order=${order.id}`);
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

  app.post('/user/topup/stripe/checkout', {
    preHandler: app.requireUser,
  }, async (request) => {
    const body = stripeCheckoutBodySchema.parse(request.body);
    const config = getStripeTopUpConfig();
    const secretKey = process.env.STRIPE_SECRET_KEY?.trim();

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
    const successUrl = buildAppUrl(`/console/topup?stripe=success&order=${order.id}`);
    const cancelUrl = buildAppUrl(`/console/topup?stripe=cancel&order=${order.id}`);
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

    const webhookSecret = process.env.CREEM_WEBHOOK_SECRET?.trim();

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

  app.post('/user/topup/stripe/webhook', async (request) => {
    const rawBody = (request as RawBodyRequest).rawBody;

    if (!rawBody) {
      throw app.httpErrors.badRequest('Stripe webhook body is missing');
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();

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
