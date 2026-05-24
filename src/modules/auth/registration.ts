import { prisma } from '../../lib/prisma.js';

const parseBooleanOption = (value: string | null | undefined, fallback = false) =>
  value === undefined || value === null ? fallback : value === 'true';

const readOption = async (key: string) => prisma.systemOption.findUnique({
  where: { key },
  select: { value: true },
});

export const isRegistrationEnabled = async () => {
  const option = await readOption('registration_enabled');

  return parseBooleanOption(option?.value, false);
};

export const isRegistrationEmailVerificationRequired = async () => {
  const option = await readOption('registration_email_verification_required');

  return parseBooleanOption(option?.value, false);
};

export const getRegistrationPolicy = async () => {
  const option = await prisma.systemOption.findUnique({
    where: { key: 'registration_enabled' },
    select: { value: true },
  });
  const verificationOption = await readOption('registration_email_verification_required');

  return {
    registrationEnabled: parseBooleanOption(option?.value, false),
    registrationEmailVerificationRequired: parseBooleanOption(verificationOption?.value, false),
  };
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

export const ensureUserIdentityAvailable = async (
  email: string,
  username: string,
  options: { allowPendingRegistrationForSameEmail?: boolean } = {},
) => {
  const [existingUserByEmail, existingUserByUsername, existingPendingByEmail, existingPendingByUsername] = await Promise.all([
    prisma.user.findUnique({
      where: { email },
      select: { id: true },
    }),
    prisma.user.findUnique({
      where: { username },
      select: { id: true },
    }),
    prisma.pendingUserRegistration.findUnique({
      where: { email },
      select: { id: true, email: true },
    }),
    prisma.pendingUserRegistration.findFirst({
      where: { username },
      select: { id: true, email: true, username: true },
    }),
  ]);

  if (existingUserByEmail || existingUserByUsername) {
    throw new Error('User already exists');
  }

  if (existingPendingByUsername && existingPendingByUsername.email !== email) {
    throw new Error('User already exists');
  }

  if (existingPendingByEmail && !options.allowPendingRegistrationForSameEmail) {
    throw new Error('User already exists');
  }
};
