import { prisma } from '../../lib/prisma.js';
import { channelSupportsModel } from './model-routing.js';
import type { RelayAttempt, RelayChannel } from './types.js';

const relayChannelSelect = {
  id: true,
  name: true,
  provider: true,
  baseUrl: true,
  model: true,
  encryptedKey: true,
  priority: true,
  weight: true,
  rateLimitPerMin: true,
  metadata: true,
} as const;

type RandomSource = () => number;

const normalizeWeight = (weight: number) => {
  if (!Number.isFinite(weight) || weight <= 0) {
    return 1;
  }

  return Math.max(1, Math.floor(weight));
};

export const weightedRandomPermutation = (
  channels: RelayChannel[],
  random: RandomSource = Math.random,
) => {
  const remaining = [...channels];
  const ordered = [] as RelayChannel[];

  while (remaining.length > 0) {
    const totalWeight = remaining.reduce((sum, channel) => sum + normalizeWeight(channel.weight), 0);
    let pick = Math.min(Math.max(random(), 0), 0.999999999) * totalWeight;
    let selectedIndex = remaining.length - 1;

    for (let index = 0; index < remaining.length; index += 1) {
      pick -= normalizeWeight(remaining[index]!.weight);

      if (pick < 0) {
        selectedIndex = index;
        break;
      }
    }

    ordered.push(remaining.splice(selectedIndex, 1)[0]!);
  }

  return ordered;
};

const groupByPriority = (channels: RelayChannel[]) => {
  const groups = new Map<number, RelayChannel[]>();

  for (const channel of channels) {
    const bucket = groups.get(channel.priority) ?? [];
    bucket.push(channel);
    groups.set(channel.priority, bucket);
  }

  return [...groups.entries()]
    .sort(([leftPriority], [rightPriority]) => rightPriority - leftPriority)
    .map(([, group]) => group);
};

export const orderRelayChannels = (
  channels: RelayChannel[],
  random: RandomSource = Math.random,
) => groupByPriority(channels).flatMap((group) => weightedRandomPermutation(group, random));

export const selectRelayChannels = async (requestedModel: string, providers?: string[]): Promise<RelayChannel[]> => {
  const channels = await prisma.channel.findMany({
    where: {
      status: 'ACTIVE',
      ...(providers && providers.length > 0 ? { provider: { in: providers } } : {}),
    },
    orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    select: relayChannelSelect,
  });
  const supported = channels.filter((channel) => channelSupportsModel(channel, requestedModel));
  const exact = supported.filter((channel) => channel.model === requestedModel);
  const wildcard = supported.filter((channel) => channel.model !== requestedModel);

  if (exact.length > 0) {
    return [
      ...orderRelayChannels(exact),
      ...orderRelayChannels(wildcard),
    ];
  }

  return orderRelayChannels(wildcard);
};

export const shouldRetryRelay = (statusCode: number) => statusCode === 429 || statusCode >= 500;

export const formatRelayAttempt = (
  channel: RelayChannel,
  statusCode: number,
  errorMessage: string | null,
): RelayAttempt => ({
  channelId: channel.id,
  channelName: channel.name,
  provider: channel.provider,
  statusCode,
  errorMessage,
});

export const summarizeRelayAttempts = (attempts: RelayAttempt[]) =>
  attempts.map((attempt) => `${attempt.channelName}:${attempt.statusCode}`).join(' -> ');

export const extractRelayErrorMessage = (body: unknown) => {
  if (typeof body === 'object' && body && 'error' in body) {
    const error = body.error;

    if (typeof error === 'string') {
      return error;
    }

    if (typeof error === 'object' && error && 'message' in error && typeof error.message === 'string') {
      return error.message;
    }
  }

  return null;
};

export const relayRetryLimit = 2;
