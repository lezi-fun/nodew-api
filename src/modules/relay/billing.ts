import type { Prisma } from '@prisma/client';

import { prisma } from '../../lib/prisma.js';
import type { RelayAttempt, RelayChannel, RelayResult } from './types.js';

type BillingUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

type BillingMetadata = {
  promptCostPerMillionCents?: number;
  completionCostPerMillionCents?: number;
  costPerMillionTokensCents?: number;
  quotaMultiplier?: number;
  quotaPerRequest?: number;
};

export type RelayLogInput = {
  userId: string;
  apiKeyId: string;
  requestId: string;
  channel: RelayChannel | null;
  provider: string;
  model: string;
  endpoint: string;
  result: RelayResult;
  success: boolean;
  errorMessage: string | null;
  latencyMs: number;
  attempts: RelayAttempt[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

const readNumber = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : undefined);

const readMetadata = (metadata: unknown): BillingMetadata => {
  if (!isRecord(metadata)) {
    return {};
  }

  return {
    promptCostPerMillionCents: readNumber(metadata.promptCostPerMillionCents),
    completionCostPerMillionCents: readNumber(metadata.completionCostPerMillionCents),
    costPerMillionTokensCents: readNumber(metadata.costPerMillionTokensCents),
    quotaMultiplier: readNumber(metadata.quotaMultiplier),
    quotaPerRequest: readNumber(metadata.quotaPerRequest),
  };
};

export const estimateCostCents = (usage: BillingUsage, channel: RelayChannel | null) => {
  const metadata = readMetadata(channel?.metadata);
  const fallbackRate = metadata.costPerMillionTokensCents ?? 0;
  const promptRate = metadata.promptCostPerMillionCents ?? fallbackRate;
  const completionRate = metadata.completionCostPerMillionCents ?? fallbackRate;
  const rawCost = ((usage.promptTokens * promptRate) + (usage.completionTokens * completionRate)) / 1_000_000;

  return rawCost > 0 ? Math.ceil(rawCost) : 0;
};

export const calculateQuotaCharge = (usage: BillingUsage, channel: RelayChannel | null) => {
  const metadata = readMetadata(channel?.metadata);
  const multiplier = metadata.quotaMultiplier ?? 1;
  const flatCharge = metadata.quotaPerRequest ?? 0;
  const rawCharge = (usage.totalTokens * multiplier) + flatCharge;

  return BigInt(Math.max(0, Math.ceil(rawCharge)));
};

export const writeRelayUsageLog = async (input: RelayLogInput) => {
  const estimatedCostCents = estimateCostCents(input.result, input.channel);
  const quotaCharge = input.success ? calculateQuotaCharge(input.result, input.channel) : 0n;
  const logData: Prisma.UsageLogCreateInput = {
    user: { connect: { id: input.userId } },
    apiKey: { connect: { id: input.apiKeyId } },
    ...(input.channel ? { channel: { connect: { id: input.channel.id } } } : {}),
    requestId: input.requestId,
    provider: input.provider,
    model: input.model,
    endpoint: input.endpoint,
    promptTokens: input.result.promptTokens,
    completionTokens: input.result.completionTokens,
    totalTokens: input.result.totalTokens,
    estimatedCostCents,
    statusCode: input.result.statusCode,
    success: input.success,
    errorMessage: input.errorMessage,
    latencyMs: input.latencyMs,
  };

  await prisma.$transaction(async (tx) => {
    await tx.usageLog.create({ data: logData });

    if (quotaCharge <= 0n) {
      return;
    }

    await tx.user.update({
      where: { id: input.userId },
      data: {
        quotaRemaining: { decrement: quotaCharge },
        quotaUsed: { increment: quotaCharge },
      },
    });

    await tx.aPIKey.updateMany({
      where: {
        id: input.apiKeyId,
        quotaRemaining: { not: null },
      },
      data: {
        quotaRemaining: { decrement: quotaCharge },
      },
    });
  });

  return {
    estimatedCostCents,
    quotaCharge,
  };
};
