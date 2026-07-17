import { prisma } from './prisma.js';

const monitoringOptionKeys = {
  autoDisableChannelEnabled: 'monitor_auto_disable_channel',
  autoEnableChannelEnabled: 'monitor_auto_enable_channel',
  autoDisableStatusCodes: 'monitor_auto_disable_status_codes',
  autoRetryStatusCodes: 'monitor_auto_retry_status_codes',
  autoDisableKeywords: 'monitor_auto_disable_keywords',
  failureThreshold: 'monitor_channel_disable_threshold',
  autoTestMinutes: 'monitor_auto_test_channel_minutes',
} as const;

const readBool = (value: string | undefined, fallback: boolean) =>
  value === undefined || value === null ? fallback : value === 'true';

const readInt = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
};

const readAll = async () => {
  const options = await prisma.systemOption.findMany({
    where: { key: { in: Object.values(monitoringOptionKeys) } },
    select: { key: true, value: true },
  });
  return new Map(options.map((o) => [o.key, o.value]));
};

export const getMonitoringSettings = async () => {
  const map = await readAll();
  return {
    autoDisableChannelEnabled: readBool(map.get(monitoringOptionKeys.autoDisableChannelEnabled), true),
    autoEnableChannelEnabled: readBool(map.get(monitoringOptionKeys.autoEnableChannelEnabled), false),
    failureThreshold: readInt(map.get(monitoringOptionKeys.failureThreshold), 3),
    autoDisableStatusCodes: (map.get(monitoringOptionKeys.autoDisableStatusCodes) ?? '').trim(),
    autoRetryStatusCodes: (map.get(monitoringOptionKeys.autoRetryStatusCodes) ?? '429,500-599').trim(),
    autoDisableKeywords: (map.get(monitoringOptionKeys.autoDisableKeywords) ?? '').trim(),
    autoTestMinutes: readInt(map.get(monitoringOptionKeys.autoTestMinutes), 10),
  };
};

const parseStatusCodeList = (input: string): number[] => {
  const codes: number[] = [];
  for (const part of input.split(',')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const range = trimmed.split('-');
    if (range.length === 2) {
      const start = Number(range[0]);
      const end = Number(range[1]);
      if (Number.isInteger(start) && Number.isInteger(end) && start > 0 && end >= start) {
        for (let code = start; code <= end; code++) codes.push(code);
      }
    } else {
      const code = Number(trimmed);
      if (Number.isInteger(code) && code > 0) codes.push(code);
    }
  }
  return codes;
};

export const shouldCountAsChannelFailure = async (statusCode: number): Promise<boolean> => {
  const settings = await getMonitoringSettings();
  if (!settings.autoDisableChannelEnabled) return false;
  const codes = parseStatusCodeList(settings.autoDisableStatusCodes);
  if (codes.length === 0) return statusCode === 401 || statusCode === 403 || statusCode === 408 || statusCode >= 500;
  return codes.includes(statusCode);
};

export const shouldRetryStatusCode = async (statusCode: number): Promise<boolean> => {
  const settings = await getMonitoringSettings();
  const codes = parseStatusCodeList(settings.autoRetryStatusCodes);
  return codes.includes(statusCode);
};

export const matchesAutoDisableKeyword = async (errorMessage: string | null): Promise<boolean> => {
  if (!errorMessage) return false;
  const settings = await getMonitoringSettings();
  if (!settings.autoDisableKeywords) return false;
  const lower = errorMessage.toLowerCase();
  return settings.autoDisableKeywords.split('\n').some((kw) => {
    const trimmed = kw.trim().toLowerCase();
    return trimmed.length > 0 && lower.includes(trimmed);
  });
};

export { monitoringOptionKeys };
