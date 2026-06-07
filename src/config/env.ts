import { z } from 'zod';

const booleanStringSchema = z.preprocess((value) => {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();

    if (['true', '1', 'yes', 'on'].includes(normalized)) {
      return true;
    }

    if (['false', '0', 'no', 'off', ''].includes(normalized)) {
      return false;
    }
  }

  return value;
}, z.boolean());

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  SESSION_SECRET: z.string().min(16).default('nodew-dev-session-secret'),
  CHANNEL_SECRET: z.string().min(16).optional(),
  APP_BASE_URL: z.string().url().optional(),
  GITHUB_OAUTH_CLIENT_ID: z.string().min(1).optional(),
  GITHUB_OAUTH_CLIENT_SECRET: z.string().min(1).optional(),
  DISCORD_OAUTH_CLIENT_ID: z.string().min(1).optional(),
  DISCORD_OAUTH_CLIENT_SECRET: z.string().min(1).optional(),
  MAIL_PROVIDER: z.enum(['disabled', 'smtp', 'resend']).default('disabled'),
  MAIL_FROM: z.string().email().optional(),
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_SECURE: booleanStringSchema.default(false),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASS: z.string().min(1).optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  STORAGE_DRIVER: z.enum(['disabled', 's3']).default('disabled'),
  STORAGE_ENDPOINT: z.string().url().optional(),
  STORAGE_REGION: z.string().min(1).default('auto'),
  STORAGE_BUCKET: z.string().min(1).optional(),
  STORAGE_ACCESS_KEY_ID: z.string().min(1).optional(),
  STORAGE_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  STORAGE_PUBLIC_BASE_URL: z.string().url().optional(),
  STORAGE_FORCE_PATH_STYLE: booleanStringSchema.default(false),
  STORAGE_PREFIX: z.string().default('nodew'),
});

export const parseEnv = (input: NodeJS.ProcessEnv = process.env) => {
  const parsed = envSchema.safeParse(input);

  if (!parsed.success) {
    throw new Error(`Invalid environment variables: ${parsed.error.message}`);
  }

  if (parsed.data.STORAGE_DRIVER === 's3') {
    const missing = [
      ['STORAGE_ENDPOINT', parsed.data.STORAGE_ENDPOINT],
      ['STORAGE_BUCKET', parsed.data.STORAGE_BUCKET],
      ['STORAGE_ACCESS_KEY_ID', parsed.data.STORAGE_ACCESS_KEY_ID],
      ['STORAGE_SECRET_ACCESS_KEY', parsed.data.STORAGE_SECRET_ACCESS_KEY],
    ].filter(([, value]) => !value).map(([key]) => key);

    if (missing.length > 0) {
      throw new Error(`Invalid environment variables: ${missing.join(', ')} are required when STORAGE_DRIVER=s3`);
    }
  }

  if (parsed.data.MAIL_PROVIDER !== 'disabled') {
    const missingCommon = [
      ['MAIL_FROM', parsed.data.MAIL_FROM],
      ['APP_BASE_URL', parsed.data.APP_BASE_URL],
    ].filter(([, value]) => !value).map(([key]) => key);

    if (missingCommon.length > 0) {
      throw new Error(`Invalid environment variables: ${missingCommon.join(', ')} are required when MAIL_PROVIDER is enabled`);
    }
  }

  if (parsed.data.MAIL_PROVIDER === 'smtp') {
    const missing = [
      ['SMTP_HOST', parsed.data.SMTP_HOST],
      ['SMTP_PORT', parsed.data.SMTP_PORT],
      ['SMTP_USER', parsed.data.SMTP_USER],
      ['SMTP_PASS', parsed.data.SMTP_PASS],
    ].filter(([, value]) => !value).map(([key]) => key);

    if (missing.length > 0) {
      throw new Error(`Invalid environment variables: ${missing.join(', ')} are required when MAIL_PROVIDER=smtp`);
    }
  }

  if (parsed.data.MAIL_PROVIDER === 'resend' && !parsed.data.RESEND_API_KEY) {
    throw new Error('Invalid environment variables: RESEND_API_KEY is required when MAIL_PROVIDER=resend');
  }

  return parsed.data;
};

export const env = parseEnv();
