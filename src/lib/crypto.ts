import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const TOKEN_PREFIX = 'sk-';

const hashSecret = (value: string, salt: string) => scryptSync(value, salt, 64).toString('hex');

export const hashPassword = (password: string) => {
  const salt = randomBytes(16).toString('hex');
  const digest = hashSecret(password, salt);

  return `${salt}:${digest}`;
};

export const verifyPassword = (password: string, storedHash: string) => {
  const [salt, digest] = storedHash.split(':');

  if (!salt || !digest) {
    return false;
  }

  const passwordBuffer = Buffer.from(hashSecret(password, salt), 'hex');
  const digestBuffer = Buffer.from(digest, 'hex');

  if (passwordBuffer.length !== digestBuffer.length) {
    return false;
  }

  return timingSafeEqual(passwordBuffer, digestBuffer);
};

export const generateAccessToken = () => randomBytes(24).toString('hex');

export const generateApiKey = () => `${TOKEN_PREFIX}${randomBytes(24).toString('hex')}`;

export const hashApiKey = (apiKey: string) => hashPassword(apiKey);

export const verifyApiKey = (apiKey: string, storedHash: string) => verifyPassword(apiKey, storedHash);

export const getApiKeyPrefix = (apiKey: string) => apiKey.slice(0, 12);

export const maskApiKey = (prefix: string) => `${prefix}••••••••••••••••`;
