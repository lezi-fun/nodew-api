import { closeTestApp, createTestApp } from '../helpers/app.js';
import { createAdminUser, createGroup, createSessionForUser, createUser } from '../helpers/factories.js';

describe('admin groups integration', () => {
  it('blocks non-admin users from listing groups', async () => {
    const user = await createUser();
    const token = await createSessionForUser(user.id);
    const app = await createTestApp();

    try {
      const response = await app.inject({
        method: 'GET',
        url: '/api/groups',
        cookies: {
          nodew_session: app.signCookie(token),
        },
      });

      expect(response.statusCode).toBe(403);
    } finally {
      await closeTestApp(app);
    }
  });

  it('lets an admin list groups with user counts', async () => {
    const admin = await createAdminUser();
    const token = await createSessionForUser(admin.id);
    const group = await createGroup({ name: 'default', description: 'Default users' });
    await createUser({ groupId: group.id });
    const app = await createTestApp();

    try {
      const response = await app.inject({
        method: 'GET',
        url: '/api/groups?keyword=default',
        cookies: {
          nodew_session: app.signCookie(token),
        },
      });

      expect(response.statusCode).toBe(200);
      const item = response.json().items.find((entry: { id: string }) => entry.id === group.id);
      expect(item).toMatchObject({
        id: group.id,
        name: 'default',
        description: 'Default users',
        userCount: 1,
      });
    } finally {
      await closeTestApp(app);
    }
  });
});
