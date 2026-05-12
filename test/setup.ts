process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL ??= 'silent';
process.env.SESSION_SECRET ??= 'nodew-test-session-secret';
process.env.CHANNEL_SECRET ??= 'nodew-test-channel-secret';
process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@127.0.0.1:5432/nodew_api';
process.env.STORAGE_DRIVER = 'disabled';
delete process.env.STORAGE_ENDPOINT;
delete process.env.STORAGE_REGION;
delete process.env.STORAGE_BUCKET;
delete process.env.STORAGE_ACCESS_KEY_ID;
delete process.env.STORAGE_SECRET_ACCESS_KEY;
delete process.env.STORAGE_PUBLIC_BASE_URL;
delete process.env.STORAGE_FORCE_PATH_STYLE;
delete process.env.STORAGE_PREFIX;

import { disconnectDatabase, resetDatabase } from './helpers/db.js';

beforeEach(async () => {
  await resetDatabase();
  vi.restoreAllMocks();
});

afterAll(async () => {
  await disconnectDatabase();
});
