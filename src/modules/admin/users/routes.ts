import { Prisma } from '@prisma/client';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { generateAccessToken, hashPassword } from '../../../../src/lib/crypto.js';
import { prisma } from '../../../../src/lib/prisma.js';
import { updateUserPassword } from '../../auth/password-reset.js';

const userParamsSchema = z.object({
  id: z.string().cuid(),
});

const userQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().cuid().optional(),
  role: z.enum(['USER', 'ADMIN']).optional(),
  status: z.enum(['ACTIVE', 'DISABLED']).optional(),
  keyword: z.string().trim().min(1).max(128).optional(),
});

const createUserBodySchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_-]+$/),
  password: z.string().min(8).max(128),
  displayName: z.string().min(1).max(64).optional(),
  role: z.enum(['USER', 'ADMIN']).default('USER'),
  status: z.enum(['ACTIVE', 'DISABLED']).default('ACTIVE'),
  groupId: z.string().cuid().nullable().optional(),
  quotaRemaining: z.coerce.bigint().optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
});

const updateUserBodySchema = z.object({
  email: z.string().email().optional(),
  username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_-]+$/).optional(),
  displayName: z.string().min(1).max(64).nullable().optional(),
  role: z.enum(['USER', 'ADMIN']).optional(),
  status: z.enum(['ACTIVE', 'DISABLED']).optional(),
  groupId: z.string().cuid().nullable().optional(),
  quotaRemaining: z.coerce.bigint().optional(),
  settings: z.record(z.string(), z.unknown()).nullable().optional(),
});

const resetPasswordBodySchema = z.object({
  password: z.string().min(8).max(128),
  revokeSession: z.boolean().default(true),
});

const groupSelect = {
  id: true,
  name: true,
} as const;

const userSelect = {
  id: true,
  email: true,
  username: true,
  displayName: true,
  role: true,
  status: true,
  group: {
    select: groupSelect,
  },
  quotaRemaining: true,
  quotaUsed: true,
  lastLoginAt: true,
  settings: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

const serializeUser = (user: {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  role: 'USER' | 'ADMIN';
  status: 'ACTIVE' | 'DISABLED';
  group: { id: string; name: string } | null;
  quotaRemaining: bigint;
  quotaUsed: bigint;
  lastLoginAt: Date | null;
  settings: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  ...user,
  quotaRemaining: user.quotaRemaining.toString(),
  quotaUsed: user.quotaUsed.toString(),
});

const ensureGroupExists = async (groupId: string | null | undefined) => {
  if (groupId === undefined || groupId === null) {
    return;
  }

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { id: true },
  });

  if (!group) {
    throw new Error('Group not found');
  }
};

const usersRoutes: FastifyPluginAsync = async (app) => {
  app.get('/users', {
    preHandler: app.requireAdminUser,
  }, async (request) => {
    const query = userQuerySchema.parse(request.query);

    const where: Prisma.UserWhereInput = {
      ...(query.role ? { role: query.role } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.keyword
        ? {
            OR: [
              { email: { contains: query.keyword, mode: 'insensitive' } },
              { username: { contains: query.keyword, mode: 'insensitive' } },
              { displayName: { contains: query.keyword, mode: 'insensitive' } },
              { group: { name: { contains: query.keyword, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const users = await prisma.user.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      select: userSelect,
    });

    const hasMore = users.length > query.limit;
    const items = hasMore ? users.slice(0, query.limit) : users;

    return {
      items: items.map(serializeUser),
      nextCursor: hasMore ? items.at(-1)?.id ?? null : null,
    };
  });

  app.get('/users/:id', {
    preHandler: app.requireAdminUser,
  }, async (request) => {
    const params = userParamsSchema.parse(request.params);

    const user = await prisma.user.findUnique({
      where: { id: params.id },
      select: userSelect,
    });

    if (!user) {
      throw app.httpErrors.notFound('User not found');
    }

    return {
      user: serializeUser(user),
    };
  });

  app.post('/users', {
    preHandler: app.requireAdminUser,
  }, async (request, reply) => {
    const body = createUserBodySchema.parse(request.body);

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email: body.email }, { username: body.username }],
      },
      select: { id: true },
    });

    if (existingUser) {
      throw app.httpErrors.conflict('User already exists');
    }

    try {
      await ensureGroupExists(body.groupId);
    } catch (error) {
      if (error instanceof Error && error.message === 'Group not found') {
        throw app.httpErrors.notFound('Group not found');
      }

      throw error;
    }

    const user = await prisma.user.create({
      data: {
        email: body.email,
        username: body.username,
        passwordHash: hashPassword(body.password),
        displayName: body.displayName,
        role: body.role,
        status: body.status,
        groupId: body.groupId === undefined ? undefined : body.groupId,
        quotaRemaining: body.quotaRemaining ?? undefined,
        settings: body.settings as Prisma.InputJsonValue | undefined,
      },
      select: userSelect,
    });

    return reply.code(201).send({
      user: serializeUser(user),
    });
  });

  app.patch('/users/:id', {
    preHandler: app.requireAdminUser,
  }, async (request) => {
    const params = userParamsSchema.parse(request.params);
    const body = updateUserBodySchema.parse(request.body);

    const existingUser = await prisma.user.findUnique({
      where: { id: params.id },
      select: { id: true },
    });

    if (!existingUser) {
      throw app.httpErrors.notFound('User not found');
    }

    try {
      await ensureGroupExists(body.groupId);
    } catch (error) {
      if (error instanceof Error && error.message === 'Group not found') {
        throw app.httpErrors.notFound('Group not found');
      }

      throw error;
    }

    const updateData: Prisma.UserUpdateInput = {
      email: body.email,
      username: body.username,
      displayName: body.displayName,
      role: body.role,
      status: body.status,
      quotaRemaining: body.quotaRemaining,
      group: body.groupId === undefined
        ? undefined
        : body.groupId === null
          ? { disconnect: true }
          : { connect: { id: body.groupId } },
    };

    if (body.settings !== undefined) {
      updateData.settings = body.settings === null ? Prisma.JsonNull : body.settings as Prisma.InputJsonValue;
    }

    if (body.status === 'DISABLED') {
      updateData.accessToken = null;
    }

    const user = await prisma.user.update({
      where: { id: params.id },
      data: updateData,
      select: userSelect,
    });

    return {
      user: serializeUser(user),
    };
  });

  app.delete('/users/:id', {
    preHandler: app.requireAdminUser,
  }, async (request) => {
    const params = userParamsSchema.parse(request.params);

    if (params.id === request.currentUser!.id) {
      throw app.httpErrors.badRequest('You cannot delete the current administrator');
    }

    const deleted = await prisma.user.deleteMany({
      where: { id: params.id },
    });

    if (deleted.count === 0) {
      throw app.httpErrors.notFound('User not found');
    }

    return {
      success: true,
    };
  });

  app.post('/users/:id/password', {
    preHandler: app.requireAdminUser,
  }, async (request) => {
    const params = userParamsSchema.parse(request.params);
    const body = resetPasswordBodySchema.parse(request.body);

    const existingUser = await prisma.user.findUnique({
      where: { id: params.id },
      select: { id: true },
    });

    if (!existingUser) {
      throw app.httpErrors.notFound('User not found');
    }

    await updateUserPassword({
      userId: params.id,
      password: body.password,
      revokeSession: body.revokeSession,
    });

    return {
      success: true,
    };
  });

  app.post('/users/:id/session/revoke', {
    preHandler: app.requireAdminUser,
  }, async (request) => {
    const params = userParamsSchema.parse(request.params);

    const updated = await prisma.user.updateMany({
      where: { id: params.id },
      data: { accessToken: null },
    });

    if (updated.count === 0) {
      throw app.httpErrors.notFound('User not found');
    }

    return {
      success: true,
    };
  });

  app.post('/users/:id/access-token', {
    preHandler: app.requireAdminUser,
  }, async (request) => {
    const params = userParamsSchema.parse(request.params);
    const accessToken = generateAccessToken();

    const updated = await prisma.user.updateMany({
      where: { id: params.id },
      data: { accessToken },
    });

    if (updated.count === 0) {
      throw app.httpErrors.notFound('User not found');
    }

    return {
      accessToken,
    };
  });
};

export default usersRoutes;
