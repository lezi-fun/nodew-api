import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { prisma } from '../../../../src/lib/prisma.js';

const groupsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().cuid().optional(),
  keyword: z.string().trim().min(1).max(128).optional(),
});

const groupParamsSchema = z.object({
  id: z.string().cuid(),
});

const createGroupBodySchema = z.object({
  name: z.string().trim().min(1).max(64),
  description: z.string().trim().min(1).max(256).nullable().optional(),
});

const updateGroupBodySchema = z.object({
  name: z.string().trim().min(1).max(64).optional(),
  description: z.string().trim().min(1).max(256).nullable().optional(),
});

const groupInclude = {
  _count: {
    select: { users: true },
  },
} as const;

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
  app.post('/groups', {
    preHandler: app.requireAdminUser,
  }, async (request, reply) => {
    const body = createGroupBodySchema.parse(request.body);

    const existing = await prisma.group.findUnique({
      where: { name: body.name },
      select: { id: true },
    });

    if (existing) {
      throw app.httpErrors.conflict('Group already exists');
    }

    const group = await prisma.group.create({
      data: {
        name: body.name,
        description: body.description ?? null,
      },
      include: groupInclude,
    });

    return reply.code(201).send({
      item: serializeGroup(group),
    });
  });

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
      include: groupInclude,
    });

    const hasMore = groups.length > query.limit;
    const items = hasMore ? groups.slice(0, query.limit) : groups;

    return {
      items: items.map(serializeGroup),
      nextCursor: hasMore ? items.at(-1)?.id ?? null : null,
    };
  });

  app.get('/groups/:id', {
    preHandler: app.requireAdminUser,
  }, async (request) => {
    const params = groupParamsSchema.parse(request.params);

    const group = await prisma.group.findUnique({
      where: { id: params.id },
      include: groupInclude,
    });

    if (!group) {
      throw app.httpErrors.notFound('Group not found');
    }

    return {
      item: serializeGroup(group),
    };
  });

  app.patch('/groups/:id', {
    preHandler: app.requireAdminUser,
  }, async (request) => {
    const params = groupParamsSchema.parse(request.params);
    const body = updateGroupBodySchema.parse(request.body);

    const existing = await prisma.group.findUnique({
      where: { id: params.id },
      select: { id: true },
    });

    if (!existing) {
      throw app.httpErrors.notFound('Group not found');
    }

    if (body.name) {
      const duplicate = await prisma.group.findFirst({
        where: {
          name: body.name,
          id: { not: params.id },
        },
        select: { id: true },
      });

      if (duplicate) {
        throw app.httpErrors.conflict('Group already exists');
      }
    }

    const group = await prisma.group.update({
      where: { id: params.id },
      data: {
        name: body.name,
        description: body.description,
      },
      include: groupInclude,
    });

    return {
      item: serializeGroup(group),
    };
  });

  app.delete('/groups/:id', {
    preHandler: app.requireAdminUser,
  }, async (request) => {
    const params = groupParamsSchema.parse(request.params);

    const group = await prisma.group.findUnique({
      where: { id: params.id },
      include: groupInclude,
    });

    if (!group) {
      throw app.httpErrors.notFound('Group not found');
    }

    if (group._count.users > 0) {
      throw app.httpErrors.conflict('Group has assigned users');
    }

    await prisma.group.delete({
      where: { id: params.id },
    });

    return {
      success: true,
    };
  });
};

export default groupsRoutes;
