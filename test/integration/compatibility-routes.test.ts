import { prisma } from '../../src/lib/prisma.js';
import { closeTestApp, createTestApp } from '../helpers/app.js';
import {
  createAdminUser,
  createApiKey,
  createChannel,
  createGroup,
  createRedemption,
  createSessionForUser,
  createUsageLog,
  createUser,
} from '../helpers/factories.js';
import { mockFetchOnce } from '../helpers/fetch.js';

describe('legacy compatibility routes', () => {
  it('serves legacy channel and group routes', async () => {
    const admin = await createAdminUser();
    const token = await createSessionForUser(admin.id);
    const group = await createGroup({ name: 'compat_group', description: 'Compatibility group' });
    const channel = await createChannel({
      name: 'Compat Channel',
      model: 'gpt-compat',
      metadata: {
        models: ['gpt-compat', 'gpt-extra'],
      },
    });
    const app = await createTestApp();

    try {
      const cookies = { nodew_session: app.signCookie(token) };
      const channelResponse = await app.inject({
        method: 'GET',
        url: '/api/channel',
        cookies,
      });
      const modelResponse = await app.inject({
        method: 'GET',
        url: '/api/channel/models_enabled',
        cookies,
      });
      const updateResponse = await app.inject({
        method: 'PUT',
        url: '/api/channel',
        cookies,
        payload: {
          id: channel.id,
          status: 'DISABLED',
        },
      });
      const groupResponse = await app.inject({
        method: 'GET',
        url: '/api/group',
        cookies,
      });

      expect(channelResponse.statusCode).toBe(200);
      expect(channelResponse.json().success).toBe(true);
      expect(channelResponse.json().data[0].name).toBe('Compat Channel');
      expect(modelResponse.statusCode).toBe(200);
      expect(modelResponse.json().data).toEqual(['gpt-compat', 'gpt-extra']);
      expect(updateResponse.statusCode).toBe(200);
      expect(updateResponse.json().data.status).toBe('DISABLED');
      expect(groupResponse.statusCode).toBe(200);
      expect(groupResponse.json().data).toEqual([group.name]);
    } finally {
      await closeTestApp(app);
    }
  });

  it('serves legacy token, log, redemption, and user group routes', async () => {
    const user = await createUser();
    const admin = await createAdminUser();
    const userToken = await createSessionForUser(user.id);
    const adminToken = await createSessionForUser(admin.id);
    const apiKey = await createApiKey(user.id, { name: 'Compat Token' });
    const channel = await createChannel({ name: 'Compat Log Channel' });
    await createUsageLog({
      userId: user.id,
      apiKeyId: apiKey.record.id,
      channelId: channel.id,
      requestId: 'compat-request',
      model: 'gpt-compat',
      totalTokens: 42,
      estimatedCostCents: 7,
    });
    await createRedemption(admin.id, { quotaAmount: 500n });
    await createGroup({ name: 'default', description: 'Default usable group' });
    const app = await createTestApp();

    try {
      const userCookies = { nodew_session: app.signCookie(userToken) };
      const adminCookies = { nodew_session: app.signCookie(adminToken) };
      const tokenResponse = await app.inject({
        method: 'GET',
        url: '/api/token/search?keyword=Compat',
        cookies: userCookies,
      });
      const selfLogResponse = await app.inject({
        method: 'GET',
        url: '/api/log/self',
        cookies: userCookies,
      });
      const selfLogStatResponse = await app.inject({
        method: 'GET',
        url: '/api/log/self/stat',
        cookies: userCookies,
      });
      const allLogResponse = await app.inject({
        method: 'GET',
        url: '/api/log',
        cookies: adminCookies,
      });
      const redemptionResponse = await app.inject({
        method: 'GET',
        url: '/api/redemption',
        cookies: adminCookies,
      });
      const userGroupsResponse = await app.inject({
        method: 'GET',
        url: '/api/user/groups',
        cookies: userCookies,
      });

      expect(tokenResponse.statusCode).toBe(200);
      expect(tokenResponse.json().data[0]).toMatchObject({
        id: apiKey.record.id,
        name: 'Compat Token',
      });
      expect(selfLogResponse.statusCode).toBe(200);
      expect(selfLogResponse.json().data[0].requestId).toBe('compat-request');
      expect(selfLogStatResponse.statusCode).toBe(200);
      expect(selfLogStatResponse.json().data.totalTokens).toBe(42);
      expect(selfLogStatResponse.json().data.quota).toBe(7);
      expect(allLogResponse.statusCode).toBe(200);
      expect(allLogResponse.json().data[0].requestId).toBe('compat-request');
      expect(redemptionResponse.statusCode).toBe(200);
      expect(redemptionResponse.json().data[0].quotaAmount).toBe('500');
      expect(userGroupsResponse.statusCode).toBe(200);
      expect(userGroupsResponse.json().data.default).toMatchObject({
        ratio: 1,
        desc: 'Default usable group',
      });
    } finally {
      await closeTestApp(app);
    }
  });

  it('does not let a user update another user token through the legacy token route', async () => {
    const owner = await createUser();
    const attacker = await createUser();
    const attackerToken = await createSessionForUser(attacker.id);
    const apiKey = await createApiKey(owner.id, { name: 'Owner Token' });
    const app = await createTestApp();

    try {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/token',
        cookies: { nodew_session: app.signCookie(attackerToken) },
        payload: {
          id: apiKey.record.id,
          name: 'Hijacked Token',
        },
      });

      expect(response.statusCode).toBe(404);
    } finally {
      await closeTestApp(app);
    }
  });

  it('serves legacy option aliases', async () => {
    const admin = await createAdminUser();
    const token = await createSessionForUser(admin.id);
    const app = await createTestApp();

    try {
      const cookies = { nodew_session: app.signCookie(token) };
      const updateResponse = await app.inject({
        method: 'PUT',
        url: '/api/option/site_name',
        cookies,
        payload: {
          value: 'Legacy NodeW',
        },
      });
      const listResponse = await app.inject({
        method: 'GET',
        url: '/api/option',
        cookies,
      });
      const detailResponse = await app.inject({
        method: 'GET',
        url: '/api/option/site_name',
        cookies,
      });

      expect(updateResponse.statusCode).toBe(200);
      expect(updateResponse.json().data).toBe('Legacy NodeW');
      expect(listResponse.statusCode).toBe(200);
      expect(listResponse.json().data.site_name).toBe('Legacy NodeW');
      expect(detailResponse.statusCode).toBe(200);
      expect(detailResponse.json().data).toBe('Legacy NodeW');
    } finally {
      await closeTestApp(app);
    }
  });

  it('serves legacy channel model discovery and tag operations', async () => {
    const admin = await createAdminUser();
    const token = await createSessionForUser(admin.id);
    const first = await createChannel({
      name: 'Legacy Tagged One',
      baseUrl: 'https://legacy-models.example.test/v1',
      model: 'gpt-legacy',
      metadata: { tags: ['blue'] },
    });
    const second = await createChannel({
      name: 'Legacy Tagged Two',
      metadata: { tags: ['blue'], models: ['gpt-second'] },
    });
    const fetchMock = mockFetchOnce({
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: {
        data: [
          { id: 'gpt-legacy' },
          { id: 'text-embedding-3-small' },
        ],
      },
    });
    const app = await createTestApp();

    try {
      const cookies = { nodew_session: app.signCookie(token) };
      const modelsResponse = await app.inject({
        method: 'GET',
        url: `/api/channel/fetch_models/${first.id}`,
        cookies,
      });
      const disableResponse = await app.inject({
        method: 'POST',
        url: '/api/channel/tag/disabled',
        cookies,
        payload: { tag: 'blue' },
      });
      const renameResponse = await app.inject({
        method: 'PUT',
        url: '/api/channel/tag',
        cookies,
        payload: { oldTag: 'blue', newTag: 'green' },
      });
      const tagModelsResponse = await app.inject({
        method: 'GET',
        url: '/api/channel/tag/models',
        cookies,
      });

      expect(modelsResponse.statusCode).toBe(200);
      expect(modelsResponse.json().data).toEqual(['gpt-legacy', 'text-embedding-3-small']);
      expect(fetchMock.mock.calls[0]?.[0]).toBe('https://legacy-models.example.test/v1/models');
      expect(disableResponse.statusCode).toBe(200);
      expect(disableResponse.json().count).toBe(2);
      expect(renameResponse.statusCode).toBe(200);
      expect(renameResponse.json().count).toBe(2);
      expect(tagModelsResponse.statusCode).toBe(200);
      expect(tagModelsResponse.json().data.green).toEqual(['gpt-4o-mini', 'gpt-legacy', 'gpt-second']);

      const channels = await prisma.channel.findMany({
        where: { id: { in: [first.id, second.id] } },
        select: { status: true, metadata: true },
      });

      expect(channels.every((channel) => channel.status === 'DISABLED')).toBe(true);
      expect(channels.every((channel) => (channel.metadata as { tags?: string[] }).tags?.includes('green'))).toBe(true);
    } finally {
      await closeTestApp(app);
    }
  });

  it('serves legacy quota data routes', async () => {
    const user = await createUser();
    const admin = await createAdminUser();
    const userToken = await createSessionForUser(user.id);
    const adminToken = await createSessionForUser(admin.id);
    await createUsageLog({
      userId: user.id,
      requestId: 'legacy-data-one',
      promptTokens: 5,
      completionTokens: 7,
      totalTokens: 12,
      estimatedCostCents: 3,
    });
    await createUsageLog({
      userId: admin.id,
      requestId: 'legacy-data-two',
      promptTokens: 11,
      completionTokens: 13,
      totalTokens: 24,
      estimatedCostCents: 9,
    });
    const app = await createTestApp();

    try {
      const userCookies = { nodew_session: app.signCookie(userToken) };
      const adminCookies = { nodew_session: app.signCookie(adminToken) };
      const allResponse = await app.inject({
        method: 'GET',
        url: '/api/data',
        cookies: adminCookies,
      });
      const usersResponse = await app.inject({
        method: 'GET',
        url: '/api/data/users',
        cookies: adminCookies,
      });
      const selfResponse = await app.inject({
        method: 'GET',
        url: '/api/data/self',
        cookies: userCookies,
      });

      expect(allResponse.statusCode).toBe(200);
      expect(allResponse.json().data[0]).toMatchObject({
        requests: 2,
        totalTokens: 36,
        quota: 12,
        users: 2,
      });
      expect(usersResponse.statusCode).toBe(200);
      expect(usersResponse.json().data).toHaveLength(2);
      expect(selfResponse.statusCode).toBe(200);
      expect(selfResponse.json().data[0]).toMatchObject({
        requests: 1,
        totalTokens: 12,
        quota: 3,
        users: 1,
      });
    } finally {
      await closeTestApp(app);
    }
  });
});
