import { closeTestApp, createTestApp } from '../helpers/app.js';
import { createUser, createSessionForUser } from '../helpers/factories.js';

describe('task routes integration', () => {
  it('creates a task and retrieves it by id', async () => {
    const user = await createUser();
    const token = await createSessionForUser(user.id);
    const app = await createTestApp();

    try {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/tasks',
        cookies: { nodew_session: app.signCookie(token) },
        payload: { model: 'gpt-test', endpoint: 'chat/completions' },
      });

      expect(createResponse.statusCode).toBe(201);
      const taskId = createResponse.json().item.id;

      const getResponse = await app.inject({
        method: 'GET',
        url: `/api/tasks/${taskId}`,
        cookies: { nodew_session: app.signCookie(token) },
      });

      expect(getResponse.statusCode).toBe(200);
      expect(getResponse.json().item.model).toBe('gpt-test');
    } finally {
      await closeTestApp(app);
    }
  });

  it('lists tasks for the current user', async () => {
    const user = await createUser();
    const token = await createSessionForUser(user.id);
    const app = await createTestApp();

    try {
      await app.inject({
        method: 'POST',
        url: '/api/tasks',
        cookies: { nodew_session: app.signCookie(token) },
        payload: { model: 'gpt-test', endpoint: 'chat/completions' },
      });

      const listResponse = await app.inject({
        method: 'GET',
        url: '/api/tasks',
        cookies: { nodew_session: app.signCookie(token) },
      });

      expect(listResponse.statusCode).toBe(200);
      expect(listResponse.json().items.length).toBe(1);
    } finally {
      await closeTestApp(app);
    }
  });
});
