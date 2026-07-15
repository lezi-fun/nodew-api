import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { prisma } from '../../lib/prisma.js';
import { getStripeTopUpConfig, createStripeCheckoutSession } from '../../lib/stripe.js';
import {
  createSubscriptionPlan,
  deleteSubscriptionPlan,
  getSubscriptionPlanById,
  listSubscriptionPlans,
  subscriptionPlanSchema,
  updateSubscriptionPlan,
} from '../../lib/subscription-plans.js';
import { appendUserSubscription, createUserSubscription, readUserSubscriptions } from '../../lib/user-subscriptions.js';

const subscriptionCheckoutBodySchema = z.object({
  planId: z.string().trim().min(1).max(64),
});

const subscriptionPlanParamsSchema = z.object({
  id: z.string().trim().min(1).max(64),
});

const subscriptionPlanBodySchema = z.object({
  plan: subscriptionPlanSchema,
});

const subscriptionBindParamsSchema = z.object({
  userId: z.string().cuid(),
});

const subscriptionBindBodySchema = z.object({
  planId: z.string().trim().min(1).max(64),
  quotaOverride: z.coerce.number().int().min(0).optional(),
  status: z.enum(['ACTIVE', 'EXPIRED']).optional(),
  startAt: z.coerce.date().optional(),
  endAt: z.coerce.date().nullable().optional(),
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
  app.get('/subscription/admin/plans', {
    preHandler: app.requireAdminUser,
  }, async () => {
    const items = await listSubscriptionPlans(true);

    return {
      success: true,
      items,
      total: items.length,
    };
  });

  app.post('/subscription/admin/plans', {
    preHandler: app.requireAdminUser,
  }, async (request) => {
    const body = subscriptionPlanBodySchema.parse(request.body);

    try {
      return {
        success: true,
        item: await createSubscriptionPlan(body.plan),
      };
    } catch (error) {
      throw app.httpErrors.badRequest(error instanceof Error ? error.message : 'Failed to create subscription plan');
    }
  });

  app.put('/subscription/admin/plans/:id', {
    preHandler: app.requireAdminUser,
  }, async (request) => {
    const params = subscriptionPlanParamsSchema.parse(request.params);
    const body = subscriptionPlanBodySchema.parse(request.body);

    try {
      return {
        success: true,
        item: await updateSubscriptionPlan(params.id, body.plan),
      };
    } catch (error) {
      if (error instanceof Error && error.message === 'Subscription plan not found') {
        throw app.httpErrors.notFound(error.message);
      }

      throw app.httpErrors.badRequest(error instanceof Error ? error.message : 'Failed to update subscription plan');
    }
  });

  app.delete('/subscription/admin/plans/:id', {
    preHandler: app.requireAdminUser,
  }, async (request) => {
    const params = subscriptionPlanParamsSchema.parse(request.params);

    try {
      await deleteSubscriptionPlan(params.id);
    } catch (error) {
      if (error instanceof Error && error.message === 'Subscription plan not found') {
        throw app.httpErrors.notFound(error.message);
      }

      throw error;
    }

    return {
      success: true,
    };
  });

  app.post('/subscription/admin/bind/:userId', {
    preHandler: app.requireAdminUser,
  }, async (request) => {
    const params = subscriptionBindParamsSchema.parse(request.params);
    const body = subscriptionBindBodySchema.parse(request.body);

    const user = await prisma.user.findUnique({
      where: { id: params.userId },
      select: { id: true, settings: true },
    });

    if (!user) {
      throw app.httpErrors.notFound('User not found');
    }

    const plan = await getSubscriptionPlanById(body.planId);

    if (!plan) {
      throw app.httpErrors.badRequest('Subscription plan not found');
    }

    const subscription = createUserSubscription({
      planId: plan.id,
      title: plan.title,
      subtitle: plan.subtitle,
      badge: plan.badge,
      description: plan.description,
      quota: plan.quota,
      quotaAmount: body.quotaOverride ?? plan.quotaAmount,
      duration: plan.duration,
      durationDays: plan.durationDays,
      features: plan.features,
      provider: 'ADMIN',
      amountCents: 0,
      currency: plan.currency,
      status: body.status,
      startAt: body.startAt,
      endAt: body.endAt,
    });

    const quotaToAdd = BigInt(subscription.quotaAmount);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          settings: appendUserSubscription(user.settings, subscription),
          quotaRemaining: { increment: quotaToAdd },
        },
      }),
    ]);

    return {
      success: true,
      item: subscription,
    };
  });

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
