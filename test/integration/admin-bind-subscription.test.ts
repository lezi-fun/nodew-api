import { prisma } from '../../src/lib/prisma.js';
import { getSubscriptionPlanById } from '../../src/lib/subscription-plans.js';
import { closeTestApp, createTestApp } from '../helpers/app.js';
import { createAdminUser, createSessionForUser, createUser } from '../helpers/factories.js';

beforeEach(async () => {
  await prisma.systemOption.create({
    data: {
      key: 'subscription_plans',
      value: JSON.stringify([
        {
          id: 'monthly-basic',
          title: '基础版',
          subtitle: '适合轻量使用',
          description: '按月提供固定额度与基础权益',
          badge: '热门',
          priceAmount: 29.9,
          currency: 'CNY',
          quota: '每月 500,000 额度',
          quotaAmount: 500000,
          duration: '30 天',
          durationDays: 30,
          features: ['基础模型访问', '标准优先级'],
          enabled: true,
          sortOrder: 100,
        },
      ]),
    },
  });
});

describe('admin bind subscription integration', () => {
  it('blocks non-admin users from binding subscriptions', async () => {
    const user = await createUser();
    const token = await createSessionForUser(user.id);
    const app = await createTestApp();

    try {
      const response = await app.inject({
        method: 'POST',
        url: `/api/subscription/admin/bind/${user.id}`,
        cookies: {
          nodew_session: app.signCookie(token),
        },
        payload: {
          planId: 'monthly-basic',
        },
      });

      expect(response.statusCode).toBe(403);
    } finally {
      await closeTestApp(app);
    }
  });

  it('rejects binding to a non-existent user', async () => {
    const admin = await createAdminUser();
    const token = await createSessionForUser(admin.id);
    const app = await createTestApp();

    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/subscription/admin/bind/clx00000000000000000000001',
        cookies: {
          nodew_session: app.signCookie(token),
        },
        payload: {
          planId: 'monthly-basic',
        },
      });

      expect(response.statusCode).toBe(404);
      expect(response.json().message).toBe('User not found');
    } finally {
      await closeTestApp(app);
    }
  });

  it('rejects binding with a plan that does not exist', async () => {
    const targetUser = await createUser({ quotaRemaining: 25n });
    const admin = await createAdminUser();
    const token = await createSessionForUser(admin.id);
    const app = await createTestApp();

    try {
      const response = await app.inject({
        method: 'POST',
        url: `/api/subscription/admin/bind/${targetUser.id}`,
        cookies: {
          nodew_session: app.signCookie(token),
        },
        payload: {
          planId: 'non-existent-plan',
        },
      });

      expect(response.statusCode).toBe(400);
    } finally {
      await closeTestApp(app);
    }
  });

  it('binds a subscription plan to a user and increments quota', async () => {
    const targetUser = await createUser({ quotaRemaining: 25n });
    const admin = await createAdminUser();
    const token = await createSessionForUser(admin.id);
    const app = await createTestApp();

    try {
      const bindResponse = await app.inject({
        method: 'POST',
        url: `/api/subscription/admin/bind/${targetUser.id}`,
        cookies: {
          nodew_session: app.signCookie(token),
        },
        payload: {
          planId: 'monthly-basic',
        },
      });

      expect(bindResponse.statusCode).toBe(200);
      const bindBody = bindResponse.json();

      expect(bindBody).toMatchObject({
        success: true,
        item: {
          planId: 'monthly-basic',
          title: '基础版',
          provider: 'ADMIN',
          status: 'ACTIVE',
        },
      });
      expect(typeof bindBody.item.id).toBe('string');
      expect(bindBody.item.startAt).toBeTruthy();
      expect(bindBody.item.quotaAmount).toBe('500000');

      const updatedUser = await prisma.user.findUnique({
        where: { id: targetUser.id },
        select: { quotaRemaining: true, settings: true },
      });

      expect(updatedUser?.quotaRemaining).toBe(500025n);
      expect(updatedUser?.settings).toMatchObject({
        subscriptions: [
          expect.objectContaining({
            planId: 'monthly-basic',
            status: 'ACTIVE',
          }),
        ],
      });
    } finally {
      await closeTestApp(app);
    }
  });

  it('respects quotaOverride, status, and endAt parameters', async () => {
    const targetUser = await createUser({ quotaRemaining: 100n });
    const admin = await createAdminUser();
    const token = await createSessionForUser(admin.id);
    const customEnd = new Date(Date.now() + 7 * 86400_000);
    const app = await createTestApp();

    try {
      const bindResponse = await app.inject({
        method: 'POST',
        url: `/api/subscription/admin/bind/${targetUser.id}`,
        cookies: {
          nodew_session: app.signCookie(token),
        },
        payload: {
          planId: 'monthly-basic',
          quotaOverride: 9999,
          status: 'ACTIVE',
          endAt: customEnd.toISOString(),
        },
      });

      expect(bindResponse.statusCode).toBe(200);
      expect(bindResponse.json()).toMatchObject({
        success: true,
        item: {
          planId: 'monthly-basic',
          quotaAmount: '9999',
          status: 'ACTIVE',
        },
      });

      const updatedUser = await prisma.user.findUnique({
        where: { id: targetUser.id },
        select: { quotaRemaining: true },
      });

      expect(updatedUser?.quotaRemaining).toBe(100n + 9999n);
    } finally {
      await closeTestApp(app);
    }
  });
});
