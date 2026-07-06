import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { prisma } from '../../lib/prisma.js';
import { getStripeTopUpConfig, createStripeCheckoutSession } from '../../lib/stripe.js';
import { getSubscriptionPlanById, listSubscriptionPlans } from '../../lib/subscription-plans.js';
import { readUserSubscriptions } from '../../lib/user-subscriptions.js';

const subscriptionCheckoutBodySchema = z.object({
  planId: z.string().trim().min(1).max(64),
});

const buildAppUrl = (path: string) => {
  const appBaseUrl = process.env.APP_BASE_URL?.trim();

  if (!appBaseUrl) {
    throw new Error('APP_BASE_URL is required for subscription checkout');
  }

  return new URL(path, appBaseUrl).toString();
};

const orderSelect = {
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

const subscriptionRoutes: FastifyPluginAsync = async (app) => {
  app.get('/subscription/plans', {
    preHandler: app.requireUser,
  }, async () => {
    const items = await listSubscriptionPlans(false);

    return {
      success: true,
      items,
      total: items.length,
    };
  });

  app.get('/subscription/self', {
    preHandler: app.requireUser,
  }, async (request) => {
    const user = await prisma.user.findUnique({
      where: { id: request.currentUser!.id },
      select: { settings: true },
    });
    const subscriptions = readUserSubscriptions(user?.settings);

    return {
      success: true,
      items: subscriptions.activeItems,
      allItems: subscriptions.items,
      total: subscriptions.items.length,
      activeTotal: subscriptions.activeItems.length,
    };
  });

  app.post('/subscription/stripe/checkout', {
    preHandler: app.requireUser,
  }, async (request) => {
    const body = subscriptionCheckoutBodySchema.parse(request.body);
    const config = getStripeTopUpConfig();
    const secretKey = process.env.STRIPE_SECRET_KEY?.trim();

    if (!config.enabled || !secretKey) {
      throw app.httpErrors.badRequest('Stripe subscription checkout is not configured');
    }

    const plan = await getSubscriptionPlanById(body.planId);

    if (!plan) {
      throw app.httpErrors.badRequest('Subscription plan is not available');
    }

    if (plan.priceAmount <= 0) {
      throw app.httpErrors.badRequest('Subscription plan price is invalid');
    }

    const amountCents = Math.round(plan.priceAmount * 100);
    const quotaAmount = BigInt(plan.quotaAmount);
    const order = await prisma.topUpOrder.create({
      data: {
        userId: request.currentUser!.id,
        provider: 'STRIPE',
        status: 'PENDING',
        quotaAmount,
        amountCents,
        currency: plan.currency.toLowerCase(),
        metadata: {
          kind: 'subscription',
          planId: plan.id,
          planTitle: plan.title,
          planSubtitle: plan.subtitle,
          badge: plan.badge,
          description: plan.description,
          quota: plan.quota,
          quotaAmount: plan.quotaAmount,
          duration: plan.duration,
          durationDays: plan.durationDays,
          features: plan.features,
        },
      },
      select: orderSelect,
    });
    const successUrl = buildAppUrl(`/console/subscription?stripe=success&order=${order.id}`);
    const cancelUrl = buildAppUrl(`/console/subscription?stripe=cancel&order=${order.id}`);
    const session = await createStripeCheckoutSession({
      secretKey,
      orderId: order.id,
      userId: request.currentUser!.id,
      userEmail: request.currentUser!.email,
      quotaAmount,
      units: 1,
      unitAmountCents: amountCents,
      currency: plan.currency.toLowerCase(),
      successUrl,
      cancelUrl,
      itemName: plan.title,
      itemDescription: plan.description || plan.quota || plan.duration || `${plan.durationDays} day subscription`,
      metadata: {
        kind: 'subscription',
        planId: plan.id,
      },
    });
    const updatedOrder = await prisma.topUpOrder.update({
      where: { id: order.id },
      data: {
        stripeSessionId: session.id,
        stripePaymentIntentId: session.paymentIntentId,
      },
      select: orderSelect,
    });

    return {
      success: true,
      checkoutUrl: session.url,
      order: serializeOrder(updatedOrder),
    };
  });
};

export default subscriptionRoutes;
