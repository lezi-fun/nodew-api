import { prisma } from '../../src/lib/prisma.js';
import { closeTestApp, createTestApp } from '../helpers/app.js';
import { createAdminUser, createChannel, createSessionForUser, createUser } from '../helpers/factories.js';
import { mockFetchOnce } from '../helpers/fetch.js';

describe('channels integration', () => {
  it('returns channel detail for an authenticated user', async () => {
    const user = await createUser();
    const token = await createSessionForUser(user.id);
    const channel = await createChannel({ name: 'Detail Channel' });
    const app = await createTestApp();

    try {
      const response = await app.inject({
        method: 'GET',
        url: `/api/channels/${channel.id}`,
        cookies: {
          nodew_session: app.signCookie(token),
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().item.name).toBe('Detail Channel');
      expect(response.json().item.keyPreview).toContain('••••');
    } finally {
      await closeTestApp(app);
    }
  });

  it('blocks non-admin users from mutating channels and reading operational routes', async () => {
    const user = await createUser();
    const token = await createSessionForUser(user.id);
    const channel = await createChannel();
    const app = await createTestApp();

    try {
      const cookies = { nodew_session: app.signCookie(token) };
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/channels',
        cookies,
        payload: {
          name: 'Blocked Channel',
          provider: 'openai',
          apiKey: 'blocked-key',
        },
      });
      const updateResponse = await app.inject({
        method: 'PATCH',
        url: `/api/channels/${channel.id}`,
        cookies,
        payload: { name: 'Blocked Update' },
      });
      const deleteResponse = await app.inject({
        method: 'DELETE',
        url: `/api/channels/${channel.id}`,
        cookies,
      });
      const keyResponse = await app.inject({
        method: 'POST',
        url: `/api/channels/${channel.id}/key`,
        cookies,
      });
      const modelsResponse = await app.inject({
        method: 'GET',
        url: `/api/channels/${channel.id}/models`,
        cookies,
      });
      const testResponse = await app.inject({
        method: 'POST',
        url: `/api/channels/${channel.id}/test`,
        cookies,
        payload: {},
      });

      expect(createResponse.statusCode).toBe(403);
      expect(updateResponse.statusCode).toBe(403);
      expect(deleteResponse.statusCode).toBe(403);
      expect(keyResponse.statusCode).toBe(403);
      expect(modelsResponse.statusCode).toBe(403);
      expect(testResponse.statusCode).toBe(403);
    } finally {
      await closeTestApp(app);
    }
  });

  it('lets an admin create, update, reveal preview, and delete a channel', async () => {
    const admin = await createAdminUser();
    const token = await createSessionForUser(admin.id);
    const app = await createTestApp();

    try {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/channels',
        cookies: {
          nodew_session: app.signCookie(token),
        },
        payload: {
          name: 'Created Channel',
          provider: 'openai',
          baseUrl: 'https://created.example.test/v1',
          model: 'gpt-created',
          apiKey: 'created-secret-key',
          priority: 5,
          weight: 3,
          metadata: { region: 'us' },
        },
      });

      expect(createResponse.statusCode).toBe(201);
      expect(createResponse.json().item.name).toBe('Created Channel');
      expect(createResponse.json().item.keyPreview).toContain('••••');
      expect(createResponse.json().item.apiKey).toBeUndefined();

      const channelId = createResponse.json().item.id as string;
      const stored = await prisma.channel.findUnique({
        where: { id: channelId },
        select: { encryptedKey: true },
      });
      expect(stored?.encryptedKey).not.toBe('created-secret-key');

      const updateResponse = await app.inject({
        method: 'PATCH',
        url: `/api/channels/${channelId}`,
        cookies: {
          nodew_session: app.signCookie(token),
        },
        payload: {
          name: 'Updated Channel',
          apiKey: 'updated-secret-key',
          priority: 9,
          weight: 4,
          metadata: { region: 'eu' },
        },
      });

      expect(updateResponse.statusCode).toBe(200);
      expect(updateResponse.json().item).toMatchObject({
        name: 'Updated Channel',
        priority: 9,
        weight: 4,
        metadata: { region: 'eu' },
      });

      const keyResponse = await app.inject({
        method: 'POST',
        url: `/api/channels/${channelId}/key`,
        cookies: {
          nodew_session: app.signCookie(token),
        },
      });

      expect(keyResponse.statusCode).toBe(200);
      expect(keyResponse.json().item.keyPreview).toContain('••••');
      expect(keyResponse.json().item.note).toBe('Plaintext keys are only returned when the channel is created.');

      const deleteResponse = await app.inject({
        method: 'DELETE',
        url: `/api/channels/${channelId}`,
        cookies: {
          nodew_session: app.signCookie(token),
        },
      });

      expect(deleteResponse.statusCode).toBe(200);
      expect(deleteResponse.json().success).toBe(true);
    } finally {
      await closeTestApp(app);
    }
  });

  it('lets an admin discover and filter OpenAI models', async () => {
    const admin = await createAdminUser();
    const token = await createSessionForUser(admin.id);
    const channel = await createChannel({ baseUrl: 'https://models.example.test/v1' });
    const fetchMock = mockFetchOnce({
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: {
        data: [
          { id: 'gpt-4o-mini', owned_by: 'openai' },
          { id: 'text-embedding-3-small', owned_by: 'openai' },
        ],
      },
    });
    const app = await createTestApp();

    try {
      const response = await app.inject({
        method: 'GET',
        url: `/api/channels/${channel.id}/models?model=gpt`,
        cookies: {
          nodew_session: app.signCookie(token),
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().item.total).toBe(1);
      expect(response.json().item.items[0].id).toBe('gpt-4o-mini');
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0]?.[0]).toBe('https://models.example.test/v1/models');
    } finally {
      await closeTestApp(app);
    }
  });

  it('lets an admin test OpenAI chat completion for a model', async () => {
    const admin = await createAdminUser();
    const token = await createSessionForUser(admin.id);
    const channel = await createChannel({ baseUrl: 'https://test.example.test/v1', model: 'gpt-test' });
    const fetchMock = mockFetchOnce({
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: {
        id: 'chat_test',
        object: 'chat.completion',
        choices: [],
      },
    });
    const app = await createTestApp();

    try {
      const response = await app.inject({
        method: 'POST',
        url: `/api/channels/${channel.id}/test`,
        cookies: {
          nodew_session: app.signCookie(token),
        },
        payload: {
          model: 'gpt-test',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().item.success).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0]?.[0]).toBe('https://test.example.test/v1/chat/completions');
      expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)).toMatchObject({
        model: 'gpt-test',
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
      });
    } finally {
      await closeTestApp(app);
    }
  });

  it('rejects model discovery for non-openai providers', async () => {
    const admin = await createAdminUser();
    const token = await createSessionForUser(admin.id);
    const channel = await createChannel({ provider: 'anthropic' });
    const app = await createTestApp();

    try {
      const response = await app.inject({
        method: 'GET',
        url: `/api/channels/${channel.id}/models`,
        cookies: {
          nodew_session: app.signCookie(token),
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().message).toBe('Model discovery is only supported for openai channels');
    } finally {
      await closeTestApp(app);
    }
  });

  it('rejects channel test for non-openai providers', async () => {
    const admin = await createAdminUser();
    const token = await createSessionForUser(admin.id);
    const channel = await createChannel({ provider: 'anthropic' });
    const app = await createTestApp();

    try {
      const response = await app.inject({
        method: 'POST',
        url: `/api/channels/${channel.id}/test`,
        cookies: {
          nodew_session: app.signCookie(token),
        },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().message).toBe('Channel test is only supported for openai channels');
    } finally {
      await closeTestApp(app);
    }
  });
});
