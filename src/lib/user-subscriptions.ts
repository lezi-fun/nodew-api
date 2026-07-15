import { randomUUID } from 'node:crypto';

import type { Prisma } from '@prisma/client';

type StoredSubscription = {
  id: string;
  planId: string;
  title: string;
  subtitle: string;
  badge: string;
  description: string;
  quota: string;
  quotaAmount: string;
  duration: string;
  durationDays: number;
  features: string[];
  provider: string;
  amountCents: number;
  currency: string;
  status: 'ACTIVE' | 'EXPIRED';
  startAt: string;
  endAt: string | null;
  createdAt: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

const readString = (value: unknown, fallback = '') =>
  typeof value === 'string' ? value : fallback;

const readNumber = (value: unknown, fallback = 0) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const readStringArray = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];

const normalizeStoredSubscription = (value: unknown): StoredSubscription | null => {
  if (!isRecord(value)) {
    return null;
  }

  const id = readString(value.id).trim();
  const planId = readString(value.planId).trim();
  const title = readString(value.title).trim();
  const startAt = readString(value.startAt).trim();

  if (!id || !planId || !title || !startAt) {
    return null;
  }

  const endAt = readString(value.endAt).trim();

  return {
    id,
    planId,
    title,
    subtitle: readString(value.subtitle),
    badge: readString(value.badge),
    description: readString(value.description),
    quota: readString(value.quota),
    quotaAmount: readString(value.quotaAmount, '0'),
    duration: readString(value.duration),
    durationDays: Math.max(0, Math.trunc(readNumber(value.durationDays, 0))),
    features: readStringArray(value.features),
    provider: readString(value.provider, 'STRIPE'),
    amountCents: Math.max(0, Math.trunc(readNumber(value.amountCents, 0))),
    currency: readString(value.currency, 'usd'),
    status: readString(value.status) === 'EXPIRED' ? 'EXPIRED' : 'ACTIVE',
    startAt,
    endAt: endAt || null,
    createdAt: readString(value.createdAt, startAt),
  };
};

export type UserSubscription = StoredSubscription;

export const readUserSubscriptions = (settings: Prisma.JsonValue | null | undefined, now = new Date()) => {
  if (!isRecord(settings) || !Array.isArray(settings.subscriptions)) {
    return {
      items: [] as UserSubscription[],
      activeItems: [] as UserSubscription[],
    };
  }

  const items = settings.subscriptions
    .map(normalizeStoredSubscription)
    .filter((item): item is UserSubscription => Boolean(item))
    .map((item) => {
      if (!item.endAt) {
        return item;
      }

      return {
        ...item,
        status: new Date(item.endAt).getTime() <= now.getTime() ? 'EXPIRED' : item.status,
      } satisfies UserSubscription;
    })
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());

  return {
    items,
    activeItems: items.filter((item) => item.status === 'ACTIVE'),
  };
};

export const appendUserSubscription = (
  settings: Prisma.JsonValue | null | undefined,
  subscription: UserSubscription,
): Prisma.InputJsonValue => {
  const current = isRecord(settings) ? { ...settings } : {};
  const subscriptions = Array.isArray(current.subscriptions) ? current.subscriptions : [];

  return {
    ...current,
    subscriptions: [subscription, ...subscriptions].slice(0, 100),
  } satisfies Prisma.InputJsonValue;
};

export type CreateUserSubscriptionInput = {
  planId: string;
  title: string;
  subtitle: string;
  badge: string;
  description: string;
  quota: string;
  quotaAmount: number;
  duration: string;
  durationDays: number;
  features: string[];
  provider: string;
  amountCents: number;
  currency: string;
  status?: 'ACTIVE' | 'EXPIRED';
  startAt?: Date;
  endAt?: Date | null;
};

export const createUserSubscription = (input: CreateUserSubscriptionInput): UserSubscription => {
  const now = input.startAt ?? new Date();
  const endAt = input.endAt ?? (input.durationDays > 0
    ? new Date(now.getTime() + input.durationDays * 86400_000)
    : null);

  return {
    id: randomUUID(),
    planId: input.planId,
    title: input.title,
    subtitle: input.subtitle,
    badge: input.badge,
    description: input.description,
    quota: input.quota,
    quotaAmount: String(input.quotaAmount),
    duration: input.duration,
    durationDays: input.durationDays,
    features: input.features,
    provider: input.provider,
    amountCents: input.amountCents,
    currency: input.currency,
    status: input.status ?? 'ACTIVE',
    startAt: now.toISOString(),
    endAt: endAt?.toISOString() ?? null,
    createdAt: now.toISOString(),
  };
};
