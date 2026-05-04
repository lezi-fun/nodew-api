import type { Prisma } from '@prisma/client';

import { generateAccessToken, hashPassword } from '../lib/crypto.js';
import { prisma } from '../lib/prisma.js';

const devAdmin = {
  email: 'test@test.com',
  username: 'test',
  password: 'testtest',
  displayName: 'Test Admin',
} as const;

const defaultOptions = {
  registration_enabled: 'false',
  self_use_mode_enabled: 'false',
  demo_site_enabled: 'false',
  site_name: 'nodew-api',
  site_description: 'Modern Node.js LLM gateway',
  default_model: 'gpt-4o-mini',
} as const;

const ensureSetupState = async (tx: Prisma.TransactionClient) => {
  const setupState = await tx.setupState.findFirst({
    select: { id: true },
  });

  if (setupState) {
    await tx.setupState.update({
      where: { id: setupState.id },
      data: {
        isInitialized: true,
        initializedAt: new Date(),
      },
    });
    return;
  }

  await tx.setupState.create({
    data: {
      isInitialized: true,
      initializedAt: new Date(),
    },
  });
};

const ensureDefaultOptions = async (tx: Prisma.TransactionClient) => {
  await Promise.all(
    Object.entries(defaultOptions).map(([key, value]) =>
      tx.systemOption.upsert({
        where: { key },
        update: {},
        create: { key, value },
      })),
  );
};

const getAvailableUsername = async (tx: Prisma.TransactionClient) => {
  const existingEmailUser = await tx.user.findUnique({
    where: { email: devAdmin.email },
    select: { username: true },
  });

  if (existingEmailUser) {
    return existingEmailUser.username;
  }

  const usernameUser = await tx.user.findUnique({
    where: { username: devAdmin.username },
    select: { id: true },
  });

  return usernameUser ? 'test_admin' : devAdmin.username;
};

export const ensureDevelopmentSeed = async () => {
  if (process.env.NODE_ENV !== 'development') {
    return;
  }

  await prisma.$transaction(async (tx) => {
    const username = await getAvailableUsername(tx);

    await tx.user.upsert({
      where: { email: devAdmin.email },
      update: {
        passwordHash: hashPassword(devAdmin.password),
        displayName: devAdmin.displayName,
        role: 'ADMIN',
        status: 'ACTIVE',
      },
      create: {
        email: devAdmin.email,
        username,
        passwordHash: hashPassword(devAdmin.password),
        displayName: devAdmin.displayName,
        role: 'ADMIN',
        status: 'ACTIVE',
        accessToken: generateAccessToken(),
      },
    });

    await ensureSetupState(tx);
    await ensureDefaultOptions(tx);
  });
};
