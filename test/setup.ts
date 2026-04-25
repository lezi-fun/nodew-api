process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL ??= 'silent';
process.env.SESSION_SECRET ??= 'nodew-test-session-secret';
process.env.CHANNEL_SECRET ??= 'nodew-test-channel-secret';
process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@127.0.0.1:5432/nodew_api';

import { disconnectDatabase, resetDatabase } from './helpers/db.js';

beforeEach(async () => {
  await resetDatabase();
  vi.restoreAllMocks();
});

afterAll(async () => {
  await disconnectDatabase();
});
