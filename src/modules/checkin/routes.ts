import { Prisma } from '@prisma/client';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { prisma } from '../../lib/prisma.js';

const checkinRewardQuotaKey = 'checkin_reward_quota';
const checkinRewardQuotaDefault = 100n;
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

const parseRewardQuota = (value: string | null | undefined) => {
  if (value === null || value === undefined || !value.trim()) {
    return checkinRewardQuotaDefault;
  }

  try {
    const parsed = BigInt(value.trim());

    return parsed > 0n ? parsed : checkinRewardQuotaDefault;
  } catch {
    return checkinRewardQuotaDefault;
  }
};

const getCheckinRewardQuota = async () => {
  const option = await prisma.systemOption.findUnique({
    where: { key: checkinRewardQuotaKey },
    select: { value: true },
  });

  return parseRewardQuota(option?.value);
};

const monthQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});

const serializeCheckinRecord = (record: {
  checkinDate: string;
  rewardQuota: bigint;
  createdAt: Date;
}) => ({
  checkinDate: record.checkinDate,
  rewardQuota: record.rewardQuota.toString(),
  createdAt: record.createdAt.toISOString(),
});

const parseCheckinDate = (value: string) => new Date(`${value}T00:00:00+08:00`);

const diffInDays = (later: string, earlier: string) =>
  Math.round((parseCheckinDate(later).getTime() - parseCheckinDate(earlier).getTime()) / (1000 * 60 * 60 * 24));

const calculateCurrentStreak = (records: Array<{ checkinDate: string }>) => {
  if (!records.length) {
    return 0;
  }

  let streak = 1;

  for (let index = records.length - 1; index > 0; index -= 1) {
    const current = records[index]!;
    const previous = records[index - 1]!;

    if (diffInDays(current.checkinDate, previous.checkinDate) !== 1) {
      break;
    }

    streak += 1;
  }

  return streak;
};

const calculateLongestStreak = (records: Array<{ checkinDate: string }>) => {
  if (!records.length) {
    return 0;
  }

  let longest = 1;
  let streak = 1;

  for (let index = 1; index < records.length; index += 1) {
    const current = records[index]!;
    const previous = records[index - 1]!;

    if (diffInDays(current.checkinDate, previous.checkinDate) === 1) {
      streak += 1;
    } else {
      streak = 1;
    }

    longest = Math.max(longest, streak);
  }

  return longest;
};

const checkinRoutes: FastifyPluginAsync = async (app) => {
  app.get('/checkin/status', {
    preHandler: app.requireUser,
  }, async (request) => {
    const userId = request.currentUser!.id;
    const { month = getCheckinDateKey().slice(0, 7) } = monthQuerySchema.parse(request.query);
    const today = getCheckinDateKey();
    const rewardQuota = await getCheckinRewardQuota();

    const [todayRecord, lastRecord, monthRecords, allRecords, totalCheckins, totalQuotaAggregate] = await Promise.all([
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
      prisma.userCheckinRecord.findMany({
        where: {
          userId,
          checkinDate: {
            startsWith: month,
          },
        },
        orderBy: { checkinDate: 'asc' },
        select: {
          checkinDate: true,
          rewardQuota: true,
          createdAt: true,
        },
      }),
      prisma.userCheckinRecord.findMany({
        where: { userId },
        orderBy: { checkinDate: 'asc' },
        select: {
          checkinDate: true,
        },
      }),
      prisma.userCheckinRecord.count({
        where: { userId },
      }),
      prisma.userCheckinRecord.aggregate({
        where: { userId },
        _sum: {
          rewardQuota: true,
        },
      }),
    ]);
    const monthQuota = monthRecords.reduce((sum, record) => sum + record.rewardQuota, 0n);
    const totalQuota = totalQuotaAggregate._sum.rewardQuota ?? 0n;
    const currentStreak = calculateCurrentStreak(allRecords);
    const longestStreak = calculateLongestStreak(allRecords);

    return {
      status: {
        enabled: true,
        checkedInToday: Boolean(todayRecord),
        today,
        rewardQuota: rewardQuota.toString(),
        lastCheckinAt: lastRecord?.createdAt.toISOString() ?? null,
        lastCheckinDate: lastRecord?.checkinDate ?? null,
        lastRewardQuota: lastRecord?.rewardQuota.toString() ?? null,
        month,
        monthCheckins: monthRecords.length,
        monthQuota: monthQuota.toString(),
        totalCheckins,
        totalQuota: totalQuota.toString(),
        currentStreak,
        longestStreak,
        records: monthRecords.map(serializeCheckinRecord),
      },
    };
  });

  app.post('/checkin', {
    preHandler: app.requireUser,
  }, async (request) => {
    const userId = request.currentUser!.id;
    const today = getCheckinDateKey();
    const rewardQuota = await getCheckinRewardQuota();

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
            rewardQuota,
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
            quotaRemaining: { increment: rewardQuota },
          },
        });

        return created;
      });

      return {
        success: true,
        rewardQuota: record.rewardQuota.toString(),
        record: serializeCheckinRecord(record),
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
