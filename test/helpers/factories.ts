import { randomUUID } from 'node:crypto';

import { APIKeyStatus, ChannelStatus, UserRole, UserStatus } from '@prisma/client';

import {
  encryptChannelKey,
  generateAccessToken,
  generateApiKey,
  getApiKeyPrefix,
  hashApiKey,
  hashPassword,
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

export const createAdminUser = async (overrides: Partial<{
  email: string;
  username: string;
  password: string;
  displayName: string | null;
  accessToken: string | null;
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
  apiKey: string;
}> = {}) => prisma.channel.create({
  data: {
    name: overrides.name ?? `Channel ${Date.now()}`,
    provider: overrides.provider ?? 'openai',
    baseUrl: overrides.baseUrl ?? 'https://example.test/v1',
    model: overrides.model ?? 'gpt-4o-mini',
    encryptedKey: encryptChannelKey(overrides.apiKey ?? 'channel-secret-key'),
    status: overrides.status ?? 'ACTIVE',
    priority: overrides.priority ?? 0,
    weight: overrides.weight ?? 1,
  },
});
