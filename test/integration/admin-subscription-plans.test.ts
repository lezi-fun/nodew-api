import { prisma } from '../../src/lib/prisma.js';
import { closeTestApp, createTestApp } from '../helpers/app.js';
import { createAdminUser, createSessionForUser, createUser } from '../helpers/factories.js';

const createPlan = (overrides: Partial<{
  id: string;
  title: string;
  enabled: boolean;
  sortOrder: number;
}> = {}) => ({
  id: overrides.id ?? 'monthly-basic',
  title: overrides.title ?? '基础版',
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
  enabled: overrides.enabled ?? true,
  sortOrder: overrides.sortOrder ?? 100,
});

describe('admin subscription plans integration', () => {
  it('blocks non-admin users from managing subscription plans', async () => {
    const user = await createUser();
    const token = await createSessionForUser(user.id);
    const app = await createTestApp();

    try {
      const response = await app.inject({
        method: 'GET',
        url: '/api/subscription/admin/plans',
        cookies: {
          nodew_session: app.signCookie(token),
        },
      });

      expect(response.statusCode).toBe(403);
    } finally {
      await closeTestApp(app);
    }
  });

  it('lets an admin create, update, list, and delete subscription plans', async () => {
    const admin = await createAdminUser();
    const token = await createSessionForUser(admin.id);
    const app = await createTestApp();

    try {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/subscription/admin/plans',
        cookies: {
          nodew_session: app.signCookie(token),
        },
        payload: {
          plan: createPlan(),
        },
      });

      expect(createResponse.statusCode).toBe(200);
      expect(createResponse.json()).toMatchObject({
        success: true,
        item: {
          id: 'monthly-basic',
          title: '基础版',
          enabled: true,
        },
      });

      const duplicateResponse = await app.inject({
        method: 'POST',
        url: '/api/subscription/admin/plans',
        cookies: {
          nodew_session: app.signCookie(token),
        },
        payload: {
          plan: createPlan(),
        },
      });

      expect(duplicateResponse.statusCode).toBe(400);

      const updateResponse = await app.inject({
        method: 'PUT',
        url: '/api/subscription/admin/plans/monthly-basic',
        cookies: {
          nodew_session: app.signCookie(token),
        },
        payload: {
          plan: createPlan({
            id: 'ignored-client-id',
            title: '基础版（暂停销售）',
            enabled: false,
            sortOrder: 120,
          }),
        },
      });

      expect(updateResponse.statusCode).toBe(200);
      expect(updateResponse.json()).toMatchObject({
        success: true,
        item: {
          id: 'monthly-basic',
          title: '基础版（暂停销售）',
          enabled: false,
          sortOrder: 120,
        },
      });

      const adminListResponse = await app.inject({
        method: 'GET',
        url: '/api/subscription/admin/plans',
        cookies: {
          nodew_session: app.signCookie(token),
        },
      });

      expect(adminListResponse.statusCode).toBe(200);
      expect(adminListResponse.json()).toMatchObject({
        success: true,
        total: 1,
        items: [
          {
            id: 'monthly-basic',
            title: '基础版（暂停销售）',
            enabled: false,
          },
        ],
      });

      const publicListResponse = await app.inject({
        method: 'GET',
        url: '/api/subscription/plans',
        cookies: {
          nodew_session: app.signCookie(token),
        },
      });

      expect(publicListResponse.statusCode).toBe(200);
      expect(publicListResponse.json()).toMatchObject({
        success: true,
        total: 0,
        items: [],
      });

      const deleteResponse = await app.inject({
        method: 'DELETE',
        url: '/api/subscription/admin/plans/monthly-basic',
        cookies: {
          nodew_session: app.signCookie(token),
        },
      });

      expect(deleteResponse.statusCode).toBe(200);
      expect(deleteResponse.json()).toEqual({ success: true });

      const storedOption = await prisma.systemOption.findUnique({
        where: { key: 'subscription_plans' },
        select: { value: true },
      });
      expect(JSON.parse(storedOption?.value ?? 'null')).toEqual([]);

      const missingDeleteResponse = await app.inject({
        method: 'DELETE',
        url: '/api/subscription/admin/plans/monthly-basic',
        cookies: {
          nodew_session: app.signCookie(token),
        },
      });
      expect(missingDeleteResponse.statusCode).toBe(404);
    } finally {
      await closeTestApp(app);
    }
  });
});
