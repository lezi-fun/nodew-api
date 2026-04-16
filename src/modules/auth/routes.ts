import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { generateAccessToken, verifyPassword } from '../../lib/crypto.js';
import { prisma } from '../../lib/prisma.js';
import { clearSessionCookie, setSessionCookie } from '../../plugins/auth.js';

const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

const authRoutes: FastifyPluginAsync = async (app) => {
  app.post('/user/login', async (request, reply) => {
    const body = loginBodySchema.parse(request.body);

    const user = await prisma.user.findUnique({
      where: { email: body.email },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        role: true,
        status: true,
        passwordHash: true,
      },
    });

    if (!user || !verifyPassword(body.password, user.passwordHash)) {
      return reply.unauthorized('Invalid email or password');
    }

    if (user.status !== 'ACTIVE') {
      return reply.forbidden('User is disabled');
    }

    const sessionToken = generateAccessToken();

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        accessToken: sessionToken,
        lastLoginAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        role: true,
        status: true,
        lastLoginAt: true,
      },
    });

    setSessionCookie(reply, sessionToken);

    return {
      user: updatedUser,
    };
  });

  app.post('/user/logout', {
    preHandler: app.requireUser,
  }, async (request, reply) => {
    await prisma.user.update({
      where: { id: request.currentUser!.id },
      data: { accessToken: null },
    });

    clearSessionCookie(reply);

    return {
      success: true,
    };
  });

  app.get('/user/token', {
    preHandler: app.requireUser,
  }, async (request, reply) => {
    const currentUser = request.currentUser;

    if (!currentUser) {
      throw app.httpErrors.unauthorized();
    }

    const token = generateAccessToken();

    await prisma.user.update({
      where: { id: currentUser.id },
      data: { accessToken: token },
    });

    setSessionCookie(reply, token);

    return {
      accessToken: token,
    };
  });
};

export default authRoutes;
