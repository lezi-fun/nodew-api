import { prisma } from '../../src/lib/prisma.js';
import { closeTestApp, createTestApp } from '../helpers/app.js';
import { createAdminUser, createSessionForUser, createUser } from '../helpers/factories.js';

describe('operation settings integration', () => {
  it('grants configured initial quota to newly registered users', async () => {
    const admin = await createAdminUser();
    const token = await createSessionForUser(admin.id);
    await prisma.setupState.create({ data: { isInitialized: true, initializedAt: new Date() } });
    const app = await createTestApp();
    const cookies = { nodew_session: app.signCookie(token) };

    try {
      await app.inject({ method: 'PUT', url: '/api/options/registration_enabled', cookies, payload: { value: true } });
      const option = await app.inject({ method: 'PUT', url: '/api/options/operation_new_user_quota', cookies, payload: { value: 12345 } });
      const response = await app.inject({
        method: 'POST', url: '/api/user/register',
        payload: { email: 'quota-register@test.local', username: 'quota_register', password: 'testtest' },
      });
      const user = await prisma.user.findUnique({ where: { email: 'quota-register@test.local' } });

      expect(option.statusCode).toBe(200);
      expect(response.statusCode).toBe(201);
      expect(user?.quotaRemaining).toBe(12345n);
    } finally {
      await closeTestApp(app);
    }
  });

  it('enforces the configured API key limit per user', async () => {
    const user = await createUser();
    const admin = await createAdminUser();
    const userToken = await createSessionForUser(user.id);
    const adminToken = await createSessionForUser(admin.id);
    const app = await createTestApp();

    try {
      const option = await app.inject({
        method: 'PUT', url: '/api/options/operation_max_user_api_keys',
        cookies: { nodew_session: app.signCookie(adminToken) }, payload: { value: 1 },
      });
      const first = await app.inject({ method: 'POST', url: '/api/token', cookies: { nodew_session: app.signCookie(userToken) }, payload: { name: 'First' } });
      const second = await app.inject({ method: 'POST', url: '/api/token', cookies: { nodew_session: app.signCookie(userToken) }, payload: { name: 'Second' } });

      expect(option.statusCode).toBe(200);
      expect(first.statusCode).toBe(201);
      expect(second.statusCode).toBe(400);
      expect(second.json().message).toBe('API key limit reached');
    } finally {
      await closeTestApp(app);
    }
  });
});
