import { prisma } from '../../src/lib/prisma.js';
import { closeTestApp, createTestApp } from '../helpers/app.js';
import { createSessionForUser, createUser } from '../helpers/factories.js';

describe('checkin integration', () => {
  it('reports status and grants daily quota once', async () => {
    const user = await createUser();
    const token = await createSessionForUser(user.id);
    await prisma.systemOption.upsert({
      where: { key: 'checkin_enabled' },
      update: { value: 'true' },
      create: { key: 'checkin_enabled', value: 'true' },
    });
    await prisma.systemOption.upsert({
      where: { key: 'checkin_min_quota' },
      update: { value: '250' },
      create: { key: 'checkin_min_quota', value: '250' },
    });
    await prisma.systemOption.upsert({
      where: { key: 'checkin_max_quota' },
      update: { value: '250' },
      create: { key: 'checkin_max_quota', value: '250' },
    });
    const app = await createTestApp();

    try {
      const cookies = {
        nodew_session: app.signCookie(token),
      };

      const beforeResponse = await app.inject({
        method: 'GET',
        url: '/api/checkin/status',
        cookies,
      });

      expect(beforeResponse.statusCode).toBe(200);
      expect(beforeResponse.json().status).toMatchObject({
        checkedInToday: false,
        minQuota: '250',
        maxQuota: '250',
        totalCheckins: 0,
        totalQuota: '0',
      });

      const claimResponse = await app.inject({
        method: 'POST',
        url: '/api/checkin',
        cookies,
      });

      expect(claimResponse.statusCode).toBe(200);

      const claimBody = claimResponse.json();
      expect(claimBody).toMatchObject({
        success: true,
        rewardQuota: '250',
      });
      expect(claimBody.record.checkinDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      const storedRecord = await prisma.userCheckinRecord.findFirst({
        where: {
          userId: user.id,
          checkinDate: claimBody.record.checkinDate,
        },
      });

      expect(storedRecord?.rewardQuota.toString()).toBe('250');

      const storedUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: {
          quotaRemaining: true,
        },
      });

      expect(storedUser?.quotaRemaining.toString()).toBe('10250');

      const afterResponse = await app.inject({
        method: 'GET',
        url: '/api/checkin/status',
        cookies,
      });

      expect(afterResponse.statusCode).toBe(200);
      const statusBody = afterResponse.json().status;
      expect(statusBody).toMatchObject({
        checkedInToday: true,
        minQuota: '250',
        maxQuota: '250',
        lastCheckinDate: claimBody.record.checkinDate,
        month: claimBody.record.checkinDate.slice(0, 7),
        monthCheckins: 1,
        monthQuota: '250',
        totalCheckins: 1,
        totalQuota: '250',
        currentStreak: 1,
        longestStreak: 1,
      });
      expect(statusBody.records).toHaveLength(1);
      expect(statusBody.records[0]).toMatchObject({
        checkinDate: claimBody.record.checkinDate,
        rewardQuota: '250',
      });

      const duplicateResponse = await app.inject({
        method: 'POST',
        url: '/api/checkin',
        cookies,
      });

      expect(duplicateResponse.statusCode).toBe(409);
      expect(duplicateResponse.json().message).toBe('Already checked in today');
    } finally {
      await closeTestApp(app);
    }
  });

  it('rejects check-in when the feature is disabled', async () => {
    const user = await createUser();
    const token = await createSessionForUser(user.id);
    await prisma.systemOption.upsert({
      where: { key: 'checkin_enabled' },
      update: { value: 'false' },
      create: { key: 'checkin_enabled', value: 'false' },
    });
    const app = await createTestApp();

    try {
      const cookies = {
        nodew_session: app.signCookie(token),
      };

      const statusResponse = await app.inject({
        method: 'GET',
        url: '/api/checkin/status',
        cookies,
      });

      expect(statusResponse.statusCode).toBe(200);
      expect(statusResponse.json().status.enabled).toBe(false);

      const claimResponse = await app.inject({
        method: 'POST',
        url: '/api/checkin',
        cookies,
      });

      expect(claimResponse.statusCode).toBe(400);
      expect(claimResponse.json().message).toBe('Check-in feature is not enabled');
    } finally {
      await closeTestApp(app);
    }
  });
});
