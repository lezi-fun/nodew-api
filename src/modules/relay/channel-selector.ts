import { prisma } from '../../lib/prisma.js';
import type { RelayAttempt, RelayChannel } from './types.js';

export const selectRelayChannels = async (requestedModel: string, providers?: string[]): Promise<RelayChannel[]> => {
  const channels = await prisma.channel.findMany({
    where: {
      status: 'ACTIVE',
      OR: [{ model: requestedModel }, { model: null }],
      ...(providers && providers.length > 0 ? { provider: { in: providers } } : {}),
    },
    orderBy: [{ priority: 'desc' }, { weight: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      name: true,
      provider: true,
      baseUrl: true,
      model: true,
      encryptedKey: true,
      priority: true,
      weight: true,
    },
  });

  return channels.sort((left, right) => {
    const leftExact = left.model === requestedModel ? 1 : 0;
    const rightExact = right.model === requestedModel ? 1 : 0;

    if (leftExact !== rightExact) {
      return rightExact - leftExact;
    }

    if (left.priority !== right.priority) {
      return right.priority - left.priority;
    }

    if (left.weight !== right.weight) {
      return right.weight - left.weight;
    }

    return left.name.localeCompare(right.name);
  });
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
