import { prisma } from '../../src/lib/prisma.js';
import { closeTestApp, createTestApp } from '../helpers/app.js';
import { createSessionForUser, createUser } from '../helpers/factories.js';

describe('user language preference integration', () => {
  it('updates language without replacing the user settings JSON', async () => {
    const user = await createUser();
    await prisma.user.update({
      where: { id: user.id },
      data: {
        settings: {
          subscriptions: [{ id: 'subscription-1', planId: 'monthly-basic' }],
          theme: 'dark',
        },
      },
    });
    const token = await createSessionForUser(user.id);
    const app = await createTestApp();

    try {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/user/self',
        cookies: {
          nodew_session: app.signCookie(token),
        },
        payload: {
          language: 'en',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().user.language).toBe('en');

      const storedUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { language: true, settings: true },
      });
      expect(storedUser?.language).toBe('en');
      expect(storedUser?.settings).toEqual({
        subscriptions: [{ id: 'subscription-1', planId: 'monthly-basic' }],
        theme: 'dark',
      });
    } finally {
      await closeTestApp(app);
    }
  });

  it('rejects unsupported languages', async () => {
    const user = await createUser();
    const token = await createSessionForUser(user.id);
    const app = await createTestApp();

    try {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/user/self',
        cookies: {
          nodew_session: app.signCookie(token),
        },
        payload: {
          language: 'fr',
        },
      });

      expect(response.statusCode).toBe(400);
    } finally {
      await closeTestApp(app);
    }
  });
});
