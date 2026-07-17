import type { Prisma } from '@prisma/client';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { prisma } from '../../lib/prisma.js';

const createTaskBodySchema = z.object({
  model: z.string().trim().min(1).max(256),
  endpoint: z.string().trim().min(1).max(256),
  input: z.record(z.string(), z.unknown()).optional(),
});

const taskParamsSchema = z.object({ id: z.string().cuid() });

const taskSelect = {
  id: true,
  userId: true,
  requestId: true,
  type: true,
  model: true,
  status: true,
  progress: true,
  output: true,
  errorCode: true,
  errorMessage: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
} as const;

const taskRoutes: FastifyPluginAsync = async (app) => {
  app.post('/tasks', {
    preHandler: app.requireUser,
  }, async (request, reply) => {
    const body = createTaskBodySchema.parse(request.body);
    const requestId = (request.headers['x-request-id'] as string | undefined) ?? crypto.randomUUID();

    const task = await prisma.relayTask.create({
      data: {
        userId: request.currentUser!.id,
        apiKeyId: request.currentApiKey?.id,
        requestId,
        type: body.endpoint.startsWith('video/') ? 'video' : 'task',
        model: body.model,
        status: 'PENDING',
        input: (body.input ?? {}) as Prisma.InputJsonValue,
      },
      select: taskSelect,
    });

    return reply.code(201).send({ item: task });
  });

  app.get('/tasks/:id', {
    preHandler: app.requireUser,
  }, async (request) => {
    const params = taskParamsSchema.parse(request.params);

    const task = await prisma.relayTask.findFirst({
      where: { id: params.id, userId: request.currentUser!.id },
      select: taskSelect,
    });

    if (!task) {
      throw app.httpErrors.notFound('Task not found');
    }

    return { item: task };
  });

  app.get('/tasks', {
    preHandler: app.requireUser,
  }, async (request) => {
    const tasks = await prisma.relayTask.findMany({
      where: { userId: request.currentUser!.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: taskSelect,
    });

    return { items: tasks };
  });

  app.post('/tasks/video', {
    preHandler: app.requireRelayApiKey,
  }, async (request, reply) => {
    const body = z.object({
      model: z.string().trim().min(1).max(256),
      prompt: z.string().trim().min(1).max(65536),
      size: z.string().optional(),
      duration: z.coerce.number().int().positive().optional(),
    }).parse(request.body);

    const requestId = (request.headers['x-request-id'] as string | undefined) ?? crypto.randomUUID();

    const task = await prisma.relayTask.create({
      data: {
        userId: request.currentUser!.id,
        apiKeyId: request.currentApiKey?.id,
        requestId,
        type: 'video',
        model: body.model,
        status: 'PROCESSING',
        input: { prompt: body.prompt, size: body.size, duration: body.duration } as Prisma.InputJsonValue,
      },
      select: taskSelect,
    });

    return reply.code(201).send({ item: task });
  });
};

export default taskRoutes;
