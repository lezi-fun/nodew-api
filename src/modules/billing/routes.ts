import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { getCreemTopUpConfig } from '../../lib/creem.js';
import { prisma } from '../../lib/prisma.js';
import {
  createStripeCheckoutSession,
  getStripeTopUpConfig,
  verifyStripeWebhookSignature,
} from '../../lib/stripe.js';

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

const stripeCheckoutBodySchema = z.object({
  units: z.coerce.number().int().positive().max(100000),
});

const buildAppUrl = (path: string) => {
  const appBaseUrl = process.env.APP_BASE_URL?.trim();

  if (!appBaseUrl) {
    throw new Error('APP_BASE_URL is required for Stripe top-up');
  }

  const url = new URL(path, appBaseUrl);
  return url.toString();
};

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

const billingRoutes: FastifyPluginAsync = async (app) => {
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
      select: {
        id: true,
        status: true,
        quotaAmount: true,
        amountCents: true,
        currency: true,
        stripeSessionId: true,
        paidAt: true,
        createdAt: true,
      },
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
      select: {
        id: true,
        status: true,
        quotaAmount: true,
        amountCents: true,
        currency: true,
        stripeSessionId: true,
        paidAt: true,
        createdAt: true,
      },
    });

    return {
      success: true,
      checkoutUrl: session.url,
      order: serializeOrder(updatedOrder),
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
