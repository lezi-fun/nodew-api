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

  it('lets an admin create and fetch a group', async () => {
    const admin = await createAdminUser();
    const token = await createSessionForUser(admin.id);
    const app = await createTestApp();

    try {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/groups',
        cookies: {
          nodew_session: app.signCookie(token),
        },
        payload: {
          name: 'trial',
          description: 'Trial users',
        },
      });

      expect(createResponse.statusCode).toBe(201);
      expect(createResponse.json().item).toMatchObject({
        name: 'trial',
        description: 'Trial users',
        userCount: 0,
      });

      const fetchResponse = await app.inject({
        method: 'GET',
        url: `/api/groups/${createResponse.json().item.id}`,
        cookies: {
          nodew_session: app.signCookie(token),
        },
      });

      expect(fetchResponse.statusCode).toBe(200);
      expect(fetchResponse.json().item.name).toBe('trial');
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

  it('lets an admin update and delete an empty group', async () => {
    const admin = await createAdminUser();
    const token = await createSessionForUser(admin.id);
    const group = await createGroup({ name: 'temporary' });
    const app = await createTestApp();

    try {
      const updateResponse = await app.inject({
        method: 'PATCH',
        url: `/api/groups/${group.id}`,
        cookies: {
          nodew_session: app.signCookie(token),
        },
        payload: {
          name: 'temporary-renamed',
          description: 'Renamed group',
        },
      });

      expect(updateResponse.statusCode).toBe(200);
      expect(updateResponse.json().item).toMatchObject({
        id: group.id,
        name: 'temporary-renamed',
        description: 'Renamed group',
      });

      const deleteResponse = await app.inject({
        method: 'DELETE',
        url: `/api/groups/${group.id}`,
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

  it('does not delete a group that has assigned users', async () => {
    const admin = await createAdminUser();
    const token = await createSessionForUser(admin.id);
    const group = await createGroup({ name: 'assigned' });
    await createUser({ groupId: group.id });
    const app = await createTestApp();

    try {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/groups/${group.id}`,
        cookies: {
          nodew_session: app.signCookie(token),
        },
      });

      expect(response.statusCode).toBe(409);
      expect(response.json().message).toBe('Group has assigned users');
    } finally {
      await closeTestApp(app);
    }
  });
});
