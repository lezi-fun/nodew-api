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

  return parsed.data;
};

export const env = parseEnv();
