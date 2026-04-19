import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

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

const CHANNEL_KEY_ALGORITHM = 'aes-256-gcm';
const CHANNEL_KEY_IV_LENGTH = 12;

const getChannelKeySecret = () => {
  const secret = process.env.CHANNEL_SECRET ?? process.env.SESSION_SECRET ?? 'nodew-dev-session-secret';

  return createHash('sha256').update(secret).digest();
};

export const encryptChannelKey = (value: string) => {
  const iv = randomBytes(CHANNEL_KEY_IV_LENGTH);
  const cipher = createCipheriv(CHANNEL_KEY_ALGORITHM, getChannelKeySecret(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
};

export const decryptChannelKey = (value: string) => {
  const [ivHex, authTagHex, encryptedHex] = value.split(':');

  if (!ivHex || !authTagHex || !encryptedHex) {
    throw new Error('Invalid encrypted channel key');
  }

  const decipher = createDecipheriv(
    CHANNEL_KEY_ALGORITHM,
    getChannelKeySecret(),
    Buffer.from(ivHex, 'hex'),
  );

  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, 'hex')),
    decipher.final(),
  ]).toString('utf8');
};

export const maskChannelKey = (value: string) => {
  if (value.length <= 8) {
    return '••••••••';
  }

  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
};

export const hasEncryptedValue = (value: string) => value.includes(':');

export const readChannelKeyPreview = (encryptedValue: string) => {
  const decryptedValue = decryptChannelKey(encryptedValue);

  return maskChannelKey(decryptedValue);
};
