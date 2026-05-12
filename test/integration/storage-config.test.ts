import { parseEnv } from '../../src/config/env.js';
import { closeTestApp, createTestApp } from '../helpers/app.js';
import { createAdminUser, createSessionForUser, createUser } from '../helpers/factories.js';

describe('object storage configuration', () => {
  it('defaults to disabled object storage', () => {
    const env = parseEnv({
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:5432/nodew_api',
      SESSION_SECRET: 'nodew-test-session-secret',
    });

    expect(env.STORAGE_DRIVER).toBe('disabled');
  });

  it('requires S3 credentials when S3 storage is enabled', () => {
    expect(() => parseEnv({
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:5432/nodew_api',
      SESSION_SECRET: 'nodew-test-session-secret',
      STORAGE_DRIVER: 's3',
      STORAGE_ENDPOINT: 'https://storage.example.com',
    })).toThrow(/STORAGE_BUCKET/);
  });

  it('parses false boolean strings correctly', () => {
    const env = parseEnv({
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:5432/nodew_api',
      SESSION_SECRET: 'nodew-test-session-secret',
      STORAGE_FORCE_PATH_STYLE: 'false',
    });

    expect(env.STORAGE_FORCE_PATH_STYLE).toBe(false);
  });

  it('returns non-sensitive storage status to admins only', async () => {
    const admin = await createAdminUser();
    const user = await createUser();
    const adminToken = await createSessionForUser(admin.id);
    const userToken = await createSessionForUser(user.id);
    const app = await createTestApp();

    try {
      const forbiddenResponse = await app.inject({
        method: 'GET',
        url: '/api/storage/status',
        cookies: { nodew_session: app.signCookie(userToken) },
      });
      const response = await app.inject({
        method: 'GET',
        url: '/api/storage/status',
        cookies: { nodew_session: app.signCookie(adminToken) },
      });

      expect(forbiddenResponse.statusCode).toBe(403);
      expect(response.statusCode).toBe(200);
      expect(response.json().data).toMatchObject({
        enabled: false,
        driver: 'disabled',
      });
      expect(JSON.stringify(response.json())).not.toContain('SECRET');
      expect(JSON.stringify(response.json())).not.toContain('ACCESS_KEY');
    } finally {
      await closeTestApp(app);
    }
  });

  it('forces S3 object prefixes under the nodew directory', async () => {
    const originalEnv = { ...process.env };

    vi.resetModules();
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:5432/nodew_api';
    process.env.SESSION_SECRET = 'nodew-test-session-secret';
    process.env.STORAGE_DRIVER = 's3';
    process.env.STORAGE_ENDPOINT = 'https://storage.example.com';
    process.env.STORAGE_BUCKET = 'nodew-test';
    process.env.STORAGE_ACCESS_KEY_ID = 'test-access-key';
    process.env.STORAGE_SECRET_ACCESS_KEY = 'test-secret-key';
    process.env.STORAGE_PREFIX = 'task-assets';

    try {
      const { getObjectStorageConfig } = await import('../../src/lib/object-storage.js');

      expect(getObjectStorageConfig().prefix).toBe('nodew/task-assets');
    } finally {
      process.env = originalEnv;
      vi.resetModules();
    }
  });
});
