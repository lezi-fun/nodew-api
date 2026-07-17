import { prisma } from './prisma.js';

export const operationOptionKeys = {
  newUserQuota: 'operation_new_user_quota',
  maxUserApiKeys: 'operation_max_user_api_keys',
  relayRetryTimes: 'operation_relay_retry_times',
  usageLogEnabled: 'operation_usage_log_enabled',
} as const;

const readOptions = async () => {
  const options = await prisma.systemOption.findMany({
    where: { key: { in: Object.values(operationOptionKeys) } },
    select: { key: true, value: true },
  });
  return new Map(options.map((option) => [option.key, option.value]));
};

const readNonNegativeInt = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
};

const readPositiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export const getOperationSettings = async () => {
  const options = await readOptions();
  return {
    newUserQuota: readNonNegativeInt(options.get(operationOptionKeys.newUserQuota), 0),
    maxUserApiKeys: readPositiveInt(options.get(operationOptionKeys.maxUserApiKeys), 1000),
    relayRetryTimes: Math.min(10, readNonNegativeInt(options.get(operationOptionKeys.relayRetryTimes), 2)),
    usageLogEnabled: options.get(operationOptionKeys.usageLogEnabled) !== 'false',
  };
};

export const getNewUserQuota = async () => BigInt((await getOperationSettings()).newUserQuota);
