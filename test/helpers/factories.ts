import { randomUUID } from 'node:crypto';

import { APIKeyStatus, ChannelStatus, Prisma, RedemptionStatus, UserRole, UserStatus } from '@prisma/client';

import {
  encryptChannelKey,
  generateAccessToken,
  generateApiKey,
  generateRedemptionCode,
  getApiKeyPrefix,
  getRedemptionCodePrefix,
  hashApiKey,
  hashPassword,
  hashRedemptionCode,
} from '../../src/lib/crypto.js';
import { prisma } from '../../src/lib/prisma.js';

const uniqueSuffix = () => randomUUID().replace(/-/g, '').slice(0, 12);

export const createUser = async (overrides: Partial<{
  email: string;
  username: string;
  password: string;
  displayName: string | null;
  role: UserRole;
  status: UserStatus;
  accessToken: string | null;
  groupId: string | null;
  quotaRemaining: bigint;
}> = {}) => {
  const password = overrides.password ?? 'testtest';
  const suffix = uniqueSuffix();

  return prisma.user.create({
    data: {
      email: overrides.email ?? `user-${suffix}@test.local`,
      username: overrides.username ?? `user_${suffix}`,
      passwordHash: hashPassword(password),
      displayName: overrides.displayName ?? 'Test User',
      role: overrides.role ?? 'USER',
      status: overrides.status ?? 'ACTIVE',
      accessToken: overrides.accessToken ?? null,
      groupId: overrides.groupId === undefined ? undefined : overrides.groupId,
      quotaRemaining: overrides.quotaRemaining ?? 10_000n,
    },
  });
};

export const createNamedUser = async (email: string, username: string, overrides: Partial<{
  password: string;
  displayName: string | null;
  role: UserRole;
  status: UserStatus;
  accessToken: string | null;
}> = {}) => createUser({
  ...overrides,
  email,
  username,
});

export const createNamedAdminUser = async (email: string, username: string, overrides: Partial<{
  password: string;
  displayName: string | null;
  accessToken: string | null;
}> = {}) => createAdminUser({
  ...overrides,
  email,
  username,
});

export const createNamedChannel = async (name: string, overrides: Partial<{
  provider: string;
  baseUrl: string | null;
  model: string | null;
  status: ChannelStatus;
  priority: number;
  weight: number;
  apiKey: string;
}> = {}) => createChannel({
  ...overrides,
  name,
});

export const createNamedApiKey = async (userId: string, name: string, overrides: Partial<{
  status: APIKeyStatus;
  expiresAt: Date | null;
  revokedAt: Date | null;
}> = {}) => createApiKey(userId, {
  ...overrides,
  name,
});

export const createGroup = async (overrides: Partial<{
  name: string;
  description: string | null;
}> = {}) => {
  const suffix = uniqueSuffix();

  return prisma.group.create({
    data: {
      name: overrides.name ?? `group_${suffix}`,
      description: overrides.description ?? null,
    },
  });
};

export const createRedemption = async (createdById: string, overrides: Partial<{
  code: string;
  quotaAmount: bigint;
  status: RedemptionStatus;
  expiresAt: Date | null;
}> = {}) => {
  const code = overrides.code ?? generateRedemptionCode();
  const record = await prisma.redemption.create({
    data: {
      codeHash: hashRedemptionCode(code),
      codePrefix: getRedemptionCodePrefix(code),
      quotaAmount: overrides.quotaAmount ?? 100n,
      status: overrides.status ?? 'ACTIVE',
      expiresAt: overrides.expiresAt ?? null,
      createdById,
    },
  });

  return { code, record };
};

export const createUsageLog = async (overrides: {
  userId: string;
  apiKeyId?: string | null;
  channelId?: string | null;
  requestId?: string | null;
  provider?: string;
  model?: string | null;
  endpoint?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  estimatedCostCents?: number | null;
  statusCode?: number | null;
  success?: boolean;
  latencyMs?: number | null;
}) => prisma.usageLog.create({
  data: {
    userId: overrides.userId,
    apiKeyId: overrides.apiKeyId ?? null,
    channelId: overrides.channelId ?? null,
    requestId: overrides.requestId ?? `request-${uniqueSuffix()}`,
    provider: overrides.provider ?? 'openai',
    model: overrides.model ?? 'gpt-4o-mini',
    endpoint: overrides.endpoint ?? '/v1/chat/completions',
    promptTokens: overrides.promptTokens ?? 1,
    completionTokens: overrides.completionTokens ?? 2,
    totalTokens: overrides.totalTokens ?? 3,
    estimatedCostCents: overrides.estimatedCostCents ?? null,
    statusCode: overrides.statusCode ?? 200,
    success: overrides.success ?? true,
    latencyMs: overrides.latencyMs ?? null,
  },
});

export const createAdminUser = async (overrides: Partial<{
  email: string;
  username: string;
  password: string;
  displayName: string | null;
  accessToken: string | null;
  groupId: string | null;
  quotaRemaining: bigint;
}> = {}) => createUser({
  ...overrides,
  role: 'ADMIN',
});

export const createSessionForUser = async (userId: string) => {
  const token = generateAccessToken();

  await prisma.user.update({
    where: { id: userId },
    data: { accessToken: token },
  });

  return token;
};

export const createApiKey = async (userId: string, overrides: Partial<{
  name: string;
  status: APIKeyStatus;
  quotaRemaining: bigint | null;
  metadata: Prisma.InputJsonValue;
  expiresAt: Date | null;
  revokedAt: Date | null;
}> = {}) => {
  const apiKey = generateApiKey();

  const record = await prisma.aPIKey.create({
    data: {
      userId,
      name: overrides.name ?? 'Test Key',
      keyHash: hashApiKey(apiKey),
      keyPrefix: getApiKeyPrefix(apiKey),
      status: overrides.status ?? 'ACTIVE',
      quotaRemaining: overrides.quotaRemaining,
      metadata: overrides.metadata,
      expiresAt: overrides.expiresAt ?? null,
      revokedAt: overrides.revokedAt ?? null,
    },
  });

  return {
    apiKey,
    record,
  };
};

export const createChannel = async (overrides: Partial<{
  name: string;
  provider: string;
  baseUrl: string | null;
  model: string | null;
  status: ChannelStatus;
  priority: number;
  weight: number;
  rateLimitPerMin: number | null;
  apiKey: string;
  metadata: Prisma.InputJsonValue;
}> = {}) => prisma.channel.create({
  data: {
    name: overrides.name ?? `Channel ${Date.now()}`,
    provider: overrides.provider ?? 'openai',
    baseUrl: overrides.baseUrl === undefined ? 'https://example.test/v1' : overrides.baseUrl,
    model: overrides.model === undefined ? 'gpt-4o-mini' : overrides.model,
    encryptedKey: encryptChannelKey(overrides.apiKey ?? 'channel-secret-key'),
    status: overrides.status ?? 'ACTIVE',
    priority: overrides.priority ?? 0,
    weight: overrides.weight ?? 1,
    rateLimitPerMin: overrides.rateLimitPerMin ?? null,
    metadata: overrides.metadata,
  },
});
