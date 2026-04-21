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
    } finally {
      await closeTestApp(app);
    }
  });

  it('limits channel model discovery to admins', async () => {
    const admin = await createAdminUser();
    const token = await createSessionForUser(admin.id);
    const channel = await createChannel();
    mockFetchOnce({
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: {
        data: [
          { id: 'gpt-4o-mini', owned_by: 'openai' },
        ],
      },
    });
    const app = await createTestApp();

    try {
      const response = await app.inject({
        method: 'GET',
        url: `/api/channels/${channel.id}/models`,
        cookies: {
          nodew_session: app.signCookie(token),
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().item.total).toBe(1);
      expect(response.json().item.items[0].id).toBe('gpt-4o-mini');
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
