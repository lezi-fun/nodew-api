import { closeTestApp, createTestApp } from '../helpers/app.js';
import { createApiKey, createSessionForUser, createUsageLog, createUser } from '../helpers/factories.js';

describe('token usage integration', () => {
  it('lets a user inspect usage for their own API key', async () => {
    const user = await createUser();
    const token = await createSessionForUser(user.id);
    const { record } = await createApiKey(user.id, { name: 'Usage Key' });
    await createUsageLog({
      userId: user.id,
      apiKeyId: record.id,
      requestId: 'token-usage-request',
      totalTokens: 42,
    });
    const app = await createTestApp();

    try {
      const response = await app.inject({
        method: 'GET',
        url: `/api/usage/token/${record.id}`,
        cookies: {
          nodew_session: app.signCookie(token),
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().token.name).toBe('Usage Key');
      expect(response.json().items[0].requestId).toBe('token-usage-request');
      expect(response.json().items[0].totalTokens).toBe(42);
    } finally {
      await closeTestApp(app);
    }
  });

  it('does not let a user inspect another user API key usage', async () => {
    const owner = await createUser();
    const other = await createUser();
    const otherToken = await createSessionForUser(other.id);
    const { record } = await createApiKey(owner.id);
    const app = await createTestApp();

    try {
      const response = await app.inject({
        method: 'GET',
        url: `/api/usage/token/${record.id}`,
        cookies: {
          nodew_session: app.signCookie(otherToken),
        },
      });

      expect(response.statusCode).toBe(404);
    } finally {
      await closeTestApp(app);
    }
  });
});
