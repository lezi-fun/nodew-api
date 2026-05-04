import type { RelayChannel } from './types.js';

type Bucket = {
  windowStartedAt: number;
  count: number;
};

const windowMs = 60_000;
const buckets = new Map<string, Bucket>();

const now = () => Date.now();

export const reserveRelayChannelSlot = (channel: RelayChannel, timestamp = now()) => {
  if (!channel.rateLimitPerMin || channel.rateLimitPerMin <= 0) {
    return true;
  }

  const bucket = buckets.get(channel.id);

  if (!bucket || timestamp - bucket.windowStartedAt >= windowMs) {
    buckets.set(channel.id, {
      windowStartedAt: timestamp,
      count: 1,
    });

    return true;
  }

  if (bucket.count >= channel.rateLimitPerMin) {
    return false;
  }

  bucket.count += 1;
  return true;
};

export const clearRelayRateLimitState = () => {
  buckets.clear();
};
