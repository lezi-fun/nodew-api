import { prisma } from '../../lib/prisma.js';
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
} as const;

const sortRelayChannels = (requestedModel: string, channels: RelayChannel[]) => channels.sort((left, right) => {
  const leftExact = left.model === requestedModel ? 1 : 0;
  const rightExact = right.model === requestedModel ? 1 : 0;

  if (leftExact !== rightExact) {
    return rightExact - leftExact;
  }

  if (left.priority !== right.priority) {
    return right.priority - left.priority;
  }

  return left.name.localeCompare(right.name);
});

const expandWeightedRing = (channels: RelayChannel[]) => channels.flatMap((channel) => Array.from({
  length: Math.max(1, channel.weight),
}, () => channel));

const rotateChannels = (ring: RelayChannel[], cursor: number) => {
  const rotated = [] as RelayChannel[];
  const seen = new Set<string>();

  for (let offset = 0; offset < ring.length; offset += 1) {
    const channel = ring[(cursor + offset) % ring.length]!;

    if (!seen.has(channel.id)) {
      rotated.push(channel);
      seen.add(channel.id);
    }
  }

  return rotated;
};

const selectionKeyFor = (params: {
  requestedModel: string;
  providers?: string[];
  channels: RelayChannel[];
}) => [
  'relay',
  params.requestedModel,
  params.providers?.join(',') ?? '*',
  params.channels.map((channel) => `${channel.id}:${channel.weight}`).join('|'),
].join(':');

const weightedRotate = async (requestedModel: string, providers: string[] | undefined, channels: RelayChannel[]) => {
  if (channels.length <= 1) {
    return channels;
  }

  const ring = expandWeightedRing(channels);
  const key = selectionKeyFor({ requestedModel, providers, channels });

  const state = await prisma.relaySelectionState.upsert({
    where: { key },
    update: { cursor: { increment: 1 } },
    create: { key, cursor: 1 },
    select: { cursor: true },
  });
  const cursor = (state.cursor - 1) % ring.length;

  return rotateChannels(ring, cursor);
};

export const selectRelayChannels = async (requestedModel: string, providers?: string[]): Promise<RelayChannel[]> => {
  const channels = await prisma.channel.findMany({
    where: {
      status: 'ACTIVE',
      OR: [{ model: requestedModel }, { model: null }],
      ...(providers && providers.length > 0 ? { provider: { in: providers } } : {}),
    },
    orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    select: relayChannelSelect,
  });
  const sorted = sortRelayChannels(requestedModel, channels);
  const exact = sorted.filter((channel) => channel.model === requestedModel);
  const wildcard = sorted.filter((channel) => channel.model !== requestedModel);

  if (exact.length > 0) {
    return [
      ...await weightedRotate(requestedModel, providers, exact),
      ...wildcard,
    ];
  }

  return weightedRotate(requestedModel, providers, wildcard);
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
