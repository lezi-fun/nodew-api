import { prisma } from '../../lib/prisma.js';

export const isRegistrationEnabled = async () => {
  const option = await prisma.systemOption.findUnique({
    where: { key: 'registration_enabled' },
    select: { value: true },
  });

  return option?.value === 'true';
};

export const ensureRegistrationAllowed = async () => {
  const [setupState, registrationEnabled] = await Promise.all([
    prisma.setupState.findFirst({
      select: { isInitialized: true },
    }),
    isRegistrationEnabled(),
  ]);

  if (!setupState?.isInitialized) {
    throw new Error('System is not initialized');
  }

  if (!registrationEnabled) {
    throw new Error('User registration is disabled');
  }
};

export const ensureUserIdentityAvailable = async (email: string, username: string) => {
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ email }, { username }],
    },
    select: { id: true },
  });

  if (existingUser) {
    throw new Error('User already exists');
  }
};
