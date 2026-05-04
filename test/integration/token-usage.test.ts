import { closeTestApp, createTestApp } from '../helpers/app.js';
import { createAdminUser, createApiKey, createSessionForUser, createUsageLog, createUser } from '../helpers/factories.js';

describe('token usage integration', () => {
  it('persists API key access metadata through token create, list, and update', async () => {
    const user = await createUser();
    const token = await createSessionForUser(user.id);
    const app = await createTestApp();

    try {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/token',
        cookies: {
          nodew_session: app.signCookie(token),
        },
        payload: {
          name: 'Scoped Key',
          metadata: {
            allowedModels: ['gpt-4o-mini'],
          },
        },
      });

      expect(createResponse.statusCode).toBe(201);
      expect(createResponse.json().item.metadata).toEqual({
        allowedModels: ['gpt-4o-mini'],
      });

      const tokenId = createResponse.json().item.id as string;
      const updateResponse = await app.inject({
        method: 'PUT',
        url: `/api/token/${tokenId}`,
        cookies: {
          nodew_session: app.signCookie(token),
        },
        payload: {
          metadata: {
            blockedModels: ['gpt-*'],
          },
        },
      });
      const listResponse = await app.inject({
        method: 'GET',
        url: '/api/token',
        cookies: {
          nodew_session: app.signCookie(token),
        },
      });

      expect(updateResponse.statusCode).toBe(200);
      expect(updateResponse.json().item.metadata).toEqual({
        blockedModels: ['gpt-*'],
      });
      expect(listResponse.statusCode).toBe(200);
      expect(listResponse.json().items[0].metadata).toEqual({
        blockedModels: ['gpt-*'],
      });
    } finally {
      await closeTestApp(app);
    }
  });

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

  it('returns usage summary totals for self and admin scopes', async () => {
    const user = await createUser();
    const token = await createSessionForUser(user.id);
    const admin = await createAdminUser();
    const adminToken = await createSessionForUser(admin.id);
    const other = await createUser();
    await createUsageLog({
      userId: user.id,
      requestId: 'usage-summary-success',
      provider: 'openai',
      promptTokens: 10,
      completionTokens: 5,
      totalTokens: 15,
      estimatedCostCents: 7,
      latencyMs: 100,
      success: true,
    });
    await createUsageLog({
      userId: user.id,
      requestId: 'usage-summary-failed',
      provider: 'openai',
      totalTokens: 0,
      estimatedCostCents: 0,
      latencyMs: 200,
      success: false,
    });
    await createUsageLog({
      userId: other.id,
      requestId: 'usage-summary-other',
      provider: 'anthropic',
      totalTokens: 20,
      estimatedCostCents: 9,
      success: true,
    });
    const app = await createTestApp();

    try {
      const selfResponse = await app.inject({
        method: 'GET',
        url: '/api/usage/self/summary',
        cookies: {
          nodew_session: app.signCookie(token),
        },
      });
      const adminResponse = await app.inject({
        method: 'GET',
        url: '/api/usage/summary',
        cookies: {
          nodew_session: app.signCookie(adminToken),
        },
      });

      expect(selfResponse.statusCode).toBe(200);
      expect(selfResponse.json()).toMatchObject({
        requests: 2,
        success: 1,
        failed: 1,
        totalTokens: 15,
        estimatedCostCents: 7,
        averageLatencyMs: 150,
      });
      expect(selfResponse.json().byProvider).toEqual([
        {
          provider: 'openai',
          requests: 2,
          totalTokens: 15,
          estimatedCostCents: 7,
        },
      ]);

      expect(adminResponse.statusCode).toBe(200);
      expect(adminResponse.json()).toMatchObject({
        requests: 3,
        success: 2,
        failed: 1,
        totalTokens: 35,
        estimatedCostCents: 16,
      });
    } finally {
      await closeTestApp(app);
    }
  });
});
