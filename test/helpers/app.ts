import { createApp } from '../../src/app.js';
import { parseEnv } from '../../src/config/env.js';
import { disconnectDatabase, resetDatabase } from './db.js';

export const createTestApp = async () => {
  const app = await createApp(parseEnv({
    ...process.env,
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
  }));

  return app;
};

export const closeTestApp = async (app: Awaited<ReturnType<typeof createApp>>) => {
  await app.close();
};

beforeEach(async () => {
  await resetDatabase();
  vi.restoreAllMocks();
});

afterAll(async () => {
  await disconnectDatabase();
});
