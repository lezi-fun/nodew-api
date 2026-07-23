import { Prisma } from '@prisma/client';

import { getMonitoringSettings, matchesAutoDisableKeyword, shouldCountAsChannelFailure } from '../../lib/monitoring-settings.js';
import { prisma } from '../../lib/prisma.js';
import type { RelayChannel } from './types.js';

type HealthMetadata = {
  autoDisable?: boolean;
  autoDisableFailureThreshold?: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

const readMetadata = (metadata: unknown) => (isRecord(metadata) ? metadata : {});

const readHealthMetadata = (metadata: unknown): HealthMetadata => {
  const value = readMetadata(metadata);

  return {
    autoDisable: typeof value.autoDisable === 'boolean' ? value.autoDisable : undefined,
    autoDisableFailureThreshold: typeof value.autoDisableFailureThreshold === 'number'
      ? value.autoDisableFailureThreshold
      : undefined,
  };
};

const getFailureThreshold = async (channel: RelayChannel) => {
  const metadata = readHealthMetadata(channel.metadata);

  if (metadata.autoDisable === false) {
    return null;
  }

  const settings = await getMonitoringSettings();
  return Math.max(1, Math.floor(metadata.autoDisableFailureThreshold ?? settings.failureThreshold));
};

export const recordRelayChannelSuccess = async (channel: RelayChannel) => {
  const metadata = readMetadata(channel.metadata);

  if (!metadata.relayHealth) {
    return;
  }

  const settings = await getMonitoringSettings();
  const shouldReEnable = settings.autoEnableChannelEnabled && channel.status === 'DISABLED';

  await prisma.channel.update({
    where: { id: channel.id },
    data: {
      ...(shouldReEnable ? { status: 'ACTIVE' as const } : {}),
      metadata: {
        ...metadata,
        relayHealth: {
          failureCount: 0,
          lastSuccessAt: new Date().toISOString(),
        },
      } as Prisma.InputJsonValue,
    },
  });
};

export const recordRelayChannelFailure = async (
  channel: RelayChannel,
  statusCode: number,
  errorMessage: string | null,
) => {
  if (!await shouldCountAsChannelFailure(statusCode)) {
    return;
  }

  const threshold = await getFailureThreshold(channel);

  if (!threshold) {
    return;
  }

  const keywordMatch = await matchesAutoDisableKeyword(errorMessage);
  const metadata = readMetadata(channel.metadata);
  const existingHealth = isRecord(metadata.relayHealth) ? metadata.relayHealth : {};
  const previousFailureCount = typeof existingHealth.failureCount === 'number' ? existingHealth.failureCount : 0;
  const failureCount = previousFailureCount + 1;
  const shouldDisable = keywordMatch || failureCount >= threshold;
  const now = new Date().toISOString();

  await prisma.channel.update({
    where: { id: channel.id },
    data: {
      ...(shouldDisable ? { status: 'DISABLED' as const } : {}),
      metadata: {
        ...metadata,
        relayHealth: {
          failureCount,
          lastFailureAt: now,
          lastFailureStatusCode: statusCode,
          lastFailureMessage: errorMessage,
          ...(shouldDisable ? { disabledAt: now, disabledReason: 'relay_failure_threshold' } : {}),
        },
      } as Prisma.InputJsonValue,
    },
  });
};
