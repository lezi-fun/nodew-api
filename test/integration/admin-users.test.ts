import { prisma } from '../../src/lib/prisma.js';
import { closeTestApp, createTestApp } from '../helpers/app.js';
import { createAdminUser, createGroup, createSessionForUser, createUser } from '../helpers/factories.js';

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
    const group = await createGroup({ name: 'operators' });
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
          groupId: group.id,
          quotaRemaining: '500',
        },
      });

      expect(createResponse.statusCode).toBe(201);
      expect(createResponse.json().user.email).toBe('created@test.local');
      expect(createResponse.json().user.group.name).toBe('operators');
      expect(createResponse.json().user.quotaRemaining).toBe('500');

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
      expect(fetchResponse.json().user.group.id).toBe(group.id);
    } finally {
      await closeTestApp(app);
    }
  });

  it('lets an admin update a user group and quota', async () => {
    const admin = await createAdminUser();
    const token = await createSessionForUser(admin.id);
    const user = await createUser();
    const group = await createGroup({ name: 'paid' });
    const app = await createTestApp();

    try {
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/users/${user.id}`,
        cookies: {
          nodew_session: app.signCookie(token),
        },
        payload: {
          groupId: group.id,
          quotaRemaining: '900',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().user.group.name).toBe('paid');
      expect(response.json().user.quotaRemaining).toBe('900');
    } finally {
      await closeTestApp(app);
    }
  });

  it('lets an admin inspect a user oauth bindings', async () => {
    const admin = await createAdminUser();
    const token = await createSessionForUser(admin.id);
    const user = await createUser();
    const app = await createTestApp();

    try {
      await prisma.userOAuthBinding.create({
        data: {
          userId: user.id,
          provider: 'github',
          providerUserId: 'github-admin-view',
          email: 'bound@test.local',
          displayName: 'Bound User',
          metadata: {
            login: 'bound-user',
          },
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/users/${user.id}/oauth/bindings`,
        cookies: {
          nodew_session: app.signCookie(token),
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        items: [
          expect.objectContaining({
            provider: 'github',
            providerName: 'GitHub',
            providerUserId: 'github-admin-view',
            email: 'bound@test.local',
            displayName: 'Bound User',
          }),
        ],
      });
    } finally {
      await closeTestApp(app);
    }
  });

  it('lets an admin unbind a user oauth account', async () => {
    const admin = await createAdminUser();
    const token = await createSessionForUser(admin.id);
    const user = await createUser();
    const app = await createTestApp();

    try {
      const binding = await prisma.userOAuthBinding.create({
        data: {
          userId: user.id,
          provider: 'github',
          providerUserId: 'github-admin-delete',
          email: 'delete@test.local',
          displayName: 'Delete Target',
          metadata: {
            login: 'delete-target',
          },
        },
      });

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/users/${user.id}/oauth/bindings/github`,
        cookies: {
          nodew_session: app.signCookie(token),
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        success: true,
      });

      const deletedBinding = await prisma.userOAuthBinding.findUnique({
        where: { id: binding.id },
      });

      expect(deletedBinding).toBeNull();
    } finally {
      await closeTestApp(app);
    }
  });
});
