import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { prisma } from '../../../../src/lib/prisma.js';

const groupsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().cuid().optional(),
  keyword: z.string().trim().min(1).max(128).optional(),
});

const serializeGroup = (group: {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  _count: { users: number };
}) => ({
  id: group.id,
  name: group.name,
  description: group.description,
  userCount: group._count.users,
  createdAt: group.createdAt,
  updatedAt: group.updatedAt,
});

const groupsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/groups', {
    preHandler: app.requireAdminUser,
  }, async (request) => {
    const query = groupsQuerySchema.parse(request.query);

    const groups = await prisma.group.findMany({
      where: query.keyword
        ? {
            OR: [
              { name: { contains: query.keyword, mode: 'insensitive' } },
              { description: { contains: query.keyword, mode: 'insensitive' } },
            ],
          }
        : undefined,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      include: {
        _count: {
          select: { users: true },
        },
      },
    });

    const hasMore = groups.length > query.limit;
    const items = hasMore ? groups.slice(0, query.limit) : groups;

    return {
      items: items.map(serializeGroup),
      nextCursor: hasMore ? items.at(-1)?.id ?? null : null,
    };
  });
};

export default groupsRoutes;
