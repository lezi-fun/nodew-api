import { Prisma } from '@prisma/client';
import type { FastifyPluginAsync } from 'fastify';

import { prisma } from '../../lib/prisma.js';

const checkinRewardQuota = 100n;
const checkinTimeZone = 'Asia/Shanghai';

const checkinDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: checkinTimeZone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const getCheckinDateKey = (date = new Date()) => {
  const parts = checkinDateFormatter.formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    throw new Error('Failed to resolve check-in date');
  }

  return `${year}-${month}-${day}`;
};

const serializeRecord = (record: {
  checkinDate: string;
  rewardQuota: bigint;
  createdAt: Date;
}) => ({
  checkinDate: record.checkinDate,
  rewardQuota: record.rewardQuota.toString(),
  createdAt: record.createdAt.toISOString(),
});

const checkinRoutes: FastifyPluginAsync = async (app) => {
  app.get('/checkin/status', {
    preHandler: app.requireUser,
  }, async (request) => {
    const userId = request.currentUser!.id;
    const today = getCheckinDateKey();

    const [todayRecord, lastRecord] = await Promise.all([
      prisma.userCheckinRecord.findFirst({
        where: {
          userId,
          checkinDate: today,
        },
        select: {
          checkinDate: true,
          rewardQuota: true,
          createdAt: true,
        },
      }),
      prisma.userCheckinRecord.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: {
          checkinDate: true,
          rewardQuota: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      status: {
        checkedInToday: Boolean(todayRecord),
        today,
        rewardQuota: checkinRewardQuota.toString(),
        lastCheckinAt: lastRecord?.createdAt.toISOString() ?? null,
        lastCheckinDate: lastRecord?.checkinDate ?? null,
        lastRewardQuota: lastRecord?.rewardQuota.toString() ?? null,
      },
    };
  });

  app.post('/checkin', {
    preHandler: app.requireUser,
  }, async (request) => {
    const userId = request.currentUser!.id;
    const today = getCheckinDateKey();

    const existingCheckin = await prisma.userCheckinRecord.findFirst({
      where: {
        userId,
        checkinDate: today,
      },
      select: {
        id: true,
      },
    });

    if (existingCheckin) {
      throw app.httpErrors.conflict('Already checked in today');
    }

    try {
      const record = await prisma.$transaction(async (tx) => {
        const created = await tx.userCheckinRecord.create({
          data: {
            userId,
            checkinDate: today,
            rewardQuota: checkinRewardQuota,
          },
          select: {
            checkinDate: true,
            rewardQuota: true,
            createdAt: true,
          },
        });

        await tx.user.update({
          where: { id: userId },
          data: {
            quotaRemaining: { increment: checkinRewardQuota },
          },
        });

        return created;
      });

      return {
        success: true,
        rewardQuota: record.rewardQuota.toString(),
        record: serializeRecord(record),
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw app.httpErrors.conflict('Already checked in today');
      }

      throw error;
    }
  });
};

export default checkinRoutes;
