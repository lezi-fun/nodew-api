import { prisma } from '../../src/lib/prisma.js';
import { closeTestApp, createTestApp } from '../helpers/app.js';
import { createSessionForUser, createUser } from '../helpers/factories.js';

describe('checkin integration', () => {
  it('reports status and grants daily quota once', async () => {
    const user = await createUser();
    const token = await createSessionForUser(user.id);
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
        rewardQuota: '100',
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
        rewardQuota: '100',
      });
      expect(claimBody.record.checkinDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      const storedRecord = await prisma.userCheckinRecord.findFirst({
        where: {
          userId: user.id,
          checkinDate: claimBody.record.checkinDate,
        },
      });

      expect(storedRecord?.rewardQuota.toString()).toBe('100');

      const storedUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: {
          quotaRemaining: true,
        },
      });

      expect(storedUser?.quotaRemaining.toString()).toBe('10100');

      const afterResponse = await app.inject({
        method: 'GET',
        url: '/api/checkin/status',
        cookies,
      });

      expect(afterResponse.statusCode).toBe(200);
      expect(afterResponse.json().status).toMatchObject({
        checkedInToday: true,
        lastCheckinDate: claimBody.record.checkinDate,
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
});
