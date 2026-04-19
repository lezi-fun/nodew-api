import { closeTestApp, createTestApp } from '../helpers/app.js';
import { createAdminUser, createSessionForUser, createUser } from '../helpers/factories.js';

describe('admin users integration', () => {
  it('blocks non-admin users from listing users', async () => {
    const user = await createUser();
    const token = await createSessionForUser(user.id);
    const app = await createTestApp();

    try {
      const response = await app.inject({
        method: 'GET',
        url: '/api/users',
        cookies: {
          nodew_session: app.signCookie(token),
        },
      });

      expect(response.statusCode).toBe(403);
    } finally {
      await closeTestApp(app);
    }
  });

  it('lets an admin create and fetch a user', async () => {
    const admin = await createAdminUser();
    const token = await createSessionForUser(admin.id);
    const app = await createTestApp();

    try {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/users',
        cookies: {
          nodew_session: app.signCookie(token),
        },
        payload: {
          email: 'created@test.local',
          username: 'created_user',
          password: 'testtest',
          displayName: 'Created User',
          role: 'USER',
        },
      });

      expect(createResponse.statusCode).toBe(201);
      expect(createResponse.json().user.email).toBe('created@test.local');

      const createdUserId = createResponse.json().user.id as string;
      const fetchResponse = await app.inject({
        method: 'GET',
        url: `/api/users/${createdUserId}`,
        cookies: {
          nodew_session: app.signCookie(token),
        },
      });

      expect(fetchResponse.statusCode).toBe(200);
      expect(fetchResponse.json().user.username).toBe('created_user');
    } finally {
      await closeTestApp(app);
    }
  });
});
