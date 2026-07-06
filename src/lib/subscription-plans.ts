import { z } from 'zod';

import { prisma } from './prisma.js';

export const subscriptionPlanOptionKey = 'subscription_plans' as const;

const subscriptionPlanSchema = z.object({
  id: z.string().trim().min(1).max(64),
  title: z.string().trim().min(1).max(64),
  subtitle: z.string().trim().max(160).default(''),
  description: z.string().trim().max(500).default(''),
  badge: z.string().trim().max(32).default(''),
  priceAmount: z.coerce.number().min(0).default(0),
  currency: z.string().trim().min(1).max(16).default('CNY'),
  quota: z.string().trim().max(120).default(''),
  quotaAmount: z.coerce.number().int().min(0).default(0),
  duration: z.string().trim().max(64).default(''),
  durationDays: z.coerce.number().int().min(0).max(3650).default(30),
  features: z.array(z.string().trim().min(1).max(120)).max(20).default([]),
  enabled: z.coerce.boolean().default(true),
  sortOrder: z.coerce.number().int().min(-9999).max(9999).default(0),
});

const subscriptionPlanListSchema = z.array(subscriptionPlanSchema).max(100);

export type SubscriptionPlan = z.infer<typeof subscriptionPlanSchema>;

const defaultSubscriptionPlans: SubscriptionPlan[] = [];

const comparePlans = (left: SubscriptionPlan, right: SubscriptionPlan) => {
  if (left.sortOrder !== right.sortOrder) {
    return right.sortOrder - left.sortOrder;
  }

  return left.id.localeCompare(right.id);
};

export const parseSubscriptionPlans = (value: string | null | undefined) => {
  if (!value?.trim()) {
    return defaultSubscriptionPlans;
  }

  const parsedJson = JSON.parse(value) as unknown;
  return subscriptionPlanListSchema.parse(parsedJson).sort(comparePlans);
};

export const getStoredSubscriptionPlans = async () => {
  const option = await prisma.systemOption.findUnique({
    where: { key: subscriptionPlanOptionKey },
    select: { value: true },
  });

  return parseSubscriptionPlans(option?.value);
};

export const listSubscriptionPlans = async (includeDisabled = false) => {
  const plans = await getStoredSubscriptionPlans();
  return includeDisabled ? plans : plans.filter((plan) => plan.enabled);
};

export const getSubscriptionPlanById = async (planId: string, includeDisabled = false) => {
  const plans = await listSubscriptionPlans(includeDisabled);
  return plans.find((plan) => plan.id === planId) ?? null;
};
