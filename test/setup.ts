process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL ??= 'silent';
process.env.SESSION_SECRET ??= 'nodew-test-session-secret';
process.env.CHANNEL_SECRET ??= 'nodew-test-channel-secret';
process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@127.0.0.1:5432/nodew_api';
process.env.APP_BASE_URL ??= 'http://127.0.0.1:3000';
process.env.MAIL_PROVIDER ??= 'disabled';
process.env.STORAGE_DRIVER = 'disabled';
delete process.env.STORAGE_ENDPOINT;
delete process.env.STORAGE_REGION;
delete process.env.STORAGE_BUCKET;
delete process.env.STORAGE_ACCESS_KEY_ID;
delete process.env.STORAGE_SECRET_ACCESS_KEY;
delete process.env.STORAGE_PUBLIC_BASE_URL;
delete process.env.STORAGE_FORCE_PATH_STYLE;
delete process.env.STORAGE_PREFIX;
delete process.env.MAIL_FROM;
delete process.env.SMTP_HOST;
delete process.env.SMTP_PORT;
delete process.env.SMTP_SECURE;
delete process.env.SMTP_USER;
delete process.env.SMTP_PASS;
delete process.env.RESEND_API_KEY;

import { disconnectDatabase, resetDatabase } from './helpers/db.js';

beforeEach(async () => {
  await resetDatabase();
  vi.restoreAllMocks();
});

afterAll(async () => {
  await disconnectDatabase();
});
