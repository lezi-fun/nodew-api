import { z } from 'zod';

import { prisma } from './prisma.js';

export const subscriptionPlanOptionKey = 'subscription_plans' as const;

export const subscriptionPlanSchema = z.object({
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

const saveSubscriptionPlans = async (plans: SubscriptionPlan[]) => {
  const normalizedPlans = subscriptionPlanListSchema.parse(plans).sort(comparePlans);

  await prisma.systemOption.upsert({
    where: { key: subscriptionPlanOptionKey },
    update: { value: JSON.stringify(normalizedPlans) },
    create: {
      key: subscriptionPlanOptionKey,
      value: JSON.stringify(normalizedPlans),
    },
  });

  return normalizedPlans;
};

export const createSubscriptionPlan = async (input: SubscriptionPlan) => {
  const plan = subscriptionPlanSchema.parse(input);
  const plans = await listSubscriptionPlans(true);

  if (plans.some((item) => item.id === plan.id)) {
    throw new Error('Subscription plan already exists');
  }

  await saveSubscriptionPlans([...plans, plan]);
  return plan;
};

export const updateSubscriptionPlan = async (planId: string, input: SubscriptionPlan) => {
  const plans = await listSubscriptionPlans(true);
  const index = plans.findIndex((item) => item.id === planId);

  if (index < 0) {
    throw new Error('Subscription plan not found');
  }

  const plan = subscriptionPlanSchema.parse({
    ...input,
    id: planId,
  });
  const nextPlans = [...plans];
  nextPlans[index] = plan;
  await saveSubscriptionPlans(nextPlans);
  return plan;
};

export const deleteSubscriptionPlan = async (planId: string) => {
  const plans = await listSubscriptionPlans(true);

  if (!plans.some((item) => item.id === planId)) {
    throw new Error('Subscription plan not found');
  }

  await saveSubscriptionPlans(plans.filter((item) => item.id !== planId));
};
