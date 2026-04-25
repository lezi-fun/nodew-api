import { prisma } from '../../src/lib/prisma.js';
import { closeTestApp, createTestApp } from '../helpers/app.js';
import { createAdminUser, createRedemption, createSessionForUser, createUser } from '../helpers/factories.js';

describe('admin redemptions integration', () => {
  it('blocks non-admin users from managing redemptions', async () => {
    const user = await createUser();
    const token = await createSessionForUser(user.id);
    const app = await createTestApp();

    try {
      const response = await app.inject({
        method: 'GET',
        url: '/api/redemptions',
        cookies: {
          nodew_session: app.signCookie(token),
        },
      });

      expect(response.statusCode).toBe(403);
    } finally {
      await closeTestApp(app);
    }
  });

  it('lets an admin create and fetch a redemption without storing plaintext code', async () => {
    const admin = await createAdminUser();
    const token = await createSessionForUser(admin.id);
    const app = await createTestApp();

    try {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/redemptions',
        cookies: {
          nodew_session: app.signCookie(token),
        },
        payload: {
          quotaAmount: '250',
        },
      });

      expect(createResponse.statusCode).toBe(201);
      expect(createResponse.json().item.quotaAmount).toBe('250');
      expect(createResponse.json().item.code).toBeTruthy();
      expect(createResponse.json().item.maskedCode).toContain('••••');

      const createdId = createResponse.json().item.id as string;
      const stored = await prisma.redemption.findUnique({
        where: { id: createdId },
      });

      expect(stored?.codeHash).toBeTruthy();
      expect(stored?.codeHash).not.toBe(createResponse.json().item.code);

      const fetchResponse = await app.inject({
        method: 'GET',
        url: `/api/redemptions/${createdId}`,
        cookies: {
          nodew_session: app.signCookie(token),
        },
      });

      expect(fetchResponse.statusCode).toBe(200);
      expect(fetchResponse.json().item.code).toBeUndefined();
      expect(fetchResponse.json().item.maskedCode).toBe(createResponse.json().item.maskedCode);
    } finally {
      await closeTestApp(app);
    }
  });

  it('lets an admin update and delete a redemption', async () => {
    const admin = await createAdminUser();
    const token = await createSessionForUser(admin.id);
    const { record } = await createRedemption(admin.id, { quotaAmount: 100n });
    const app = await createTestApp();

    try {
      const updateResponse = await app.inject({
        method: 'PATCH',
        url: `/api/redemptions/${record.id}`,
        cookies: {
          nodew_session: app.signCookie(token),
        },
        payload: {
          status: 'REVOKED',
          quotaAmount: '300',
        },
      });

      expect(updateResponse.statusCode).toBe(200);
      expect(updateResponse.json().item.status).toBe('REVOKED');
      expect(updateResponse.json().item.quotaAmount).toBe('300');

      const deleteResponse = await app.inject({
        method: 'DELETE',
        url: `/api/redemptions/${record.id}`,
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
});
