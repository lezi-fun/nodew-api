import { createApp } from '../../src/app.js';
import { parseEnv } from '../../src/config/env.js';

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
