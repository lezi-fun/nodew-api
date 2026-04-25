import { prisma } from '../../src/lib/prisma.js';
import { closeTestApp, createTestApp } from '../helpers/app.js';
import { createAdminUser, createRedemption, createSessionForUser, createUser } from '../helpers/factories.js';

describe('user redemptions integration', () => {
  it('redeems an active code and increments user quota once', async () => {
    const admin = await createAdminUser();
    const user = await createUser({ quotaRemaining: 25n });
    const token = await createSessionForUser(user.id);
    const { code, record } = await createRedemption(admin.id, { quotaAmount: 125n });
    const app = await createTestApp();

    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/user/redemption/redeem',
        cookies: {
          nodew_session: app.signCookie(token),
        },
        payload: {
          code,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        success: true,
        quotaAmount: '125',
        quotaRemaining: '150',
        quotaUsed: '0',
      });

      const storedRedemption = await prisma.redemption.findUnique({
        where: { id: record.id },
      });
      const storedUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { quotaRemaining: true },
      });

      expect(storedRedemption?.status).toBe('REDEEMED');
      expect(storedRedemption?.redeemedByUserId).toBe(user.id);
      expect(storedRedemption?.redeemedAt).not.toBeNull();
      expect(storedUser?.quotaRemaining).toBe(150n);
    } finally {
      await closeTestApp(app);
    }
  });

  it('rejects reused redemption codes without incrementing quota again', async () => {
    const admin = await createAdminUser();
    const user = await createUser({ quotaRemaining: 0n });
    const token = await createSessionForUser(user.id);
    const { code } = await createRedemption(admin.id, { quotaAmount: 50n });
    const app = await createTestApp();

    try {
      const firstResponse = await app.inject({
        method: 'POST',
        url: '/api/user/redemption/redeem',
        cookies: {
          nodew_session: app.signCookie(token),
        },
        payload: { code },
      });
      const secondResponse = await app.inject({
        method: 'POST',
        url: '/api/user/redemption/redeem',
        cookies: {
          nodew_session: app.signCookie(token),
        },
        payload: { code },
      });

      expect(firstResponse.statusCode).toBe(200);
      expect(secondResponse.statusCode).toBe(400);
      expect(secondResponse.json().message).toBe('Redemption code is invalid or expired');

      const storedUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { quotaRemaining: true },
      });

      expect(storedUser?.quotaRemaining).toBe(50n);
    } finally {
      await closeTestApp(app);
    }
  });

  it('rejects revoked, expired, and missing redemption codes', async () => {
    const admin = await createAdminUser();
    const user = await createUser({ quotaRemaining: 7n });
    const token = await createSessionForUser(user.id);
    const revoked = await createRedemption(admin.id, { status: 'REVOKED', quotaAmount: 100n });
    const expired = await createRedemption(admin.id, {
      quotaAmount: 100n,
      expiresAt: new Date(Date.now() - 1000),
    });
    const app = await createTestApp();

    try {
      for (const code of [revoked.code, expired.code, 'missing-code']) {
        const response = await app.inject({
          method: 'POST',
          url: '/api/user/redemption/redeem',
          cookies: {
            nodew_session: app.signCookie(token),
          },
          payload: { code },
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().message).toBe('Redemption code is invalid or expired');
      }

      const storedUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { quotaRemaining: true },
      });

      expect(storedUser?.quotaRemaining).toBe(7n);
    } finally {
      await closeTestApp(app);
    }
  });
});
