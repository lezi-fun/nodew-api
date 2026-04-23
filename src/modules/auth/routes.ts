import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { generateAccessToken, generatePasswordResetToken, hashPassword, verifyPassword } from '../../lib/crypto.js';
import { prisma } from '../../lib/prisma.js';
import { clearSessionCookie, setSessionCookie } from '../../plugins/auth.js';
import { setPasswordResetToken, updateUserPassword, canUsePasswordResetToken } from './password-reset.js';
import { ensureRegistrationAllowed, ensureUserIdentityAvailable } from './registration.js';

const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

const registerBodySchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_-]+$/),
  password: z.string().min(8).max(128),
  displayName: z.string().min(1).max(64).optional(),
});

const forgotPasswordBodySchema = z.object({
  email: z.string().email(),
});

const resetPasswordBodySchema = z.object({
  email: z.string().email(),
  token: z.string().min(1).max(256),
  password: z.string().min(8).max(128),
});

const authUserSelect = {
  id: true,
  email: true,
  username: true,
  displayName: true,
  role: true,
  status: true,
  lastLoginAt: true,
} as const;

const loginUserSelect = {
  ...authUserSelect,
  passwordHash: true,
} as const;

const serializeAuthUser = (user: {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  role: 'USER' | 'ADMIN';
  status: 'ACTIVE' | 'DISABLED';
  lastLoginAt: Date | null;
}) => user;

const createSessionForUser = async (userId: string) => {
  const sessionToken = generateAccessToken();

  return prisma.user.update({
    where: { id: userId },
    data: {
      accessToken: sessionToken,
      lastLoginAt: new Date(),
    },
    select: authUserSelect,
  }).then((user) => ({ user, sessionToken }));
};

const authRoutes: FastifyPluginAsync = async (app) => {
  app.post('/user/register', async (request, reply) => {
    const body = registerBodySchema.parse(request.body);

    try {
      await ensureRegistrationAllowed();
      await ensureUserIdentityAvailable(body.email, body.username);
    } catch (error) {
      if (error instanceof Error && error.message === 'System is not initialized') {
        throw app.httpErrors.conflict('System is not initialized');
      }

      if (error instanceof Error && error.message === 'User registration is disabled') {
        throw app.httpErrors.forbidden('User registration is disabled');
      }

      if (error instanceof Error && error.message === 'User already exists') {
        throw app.httpErrors.conflict('User already exists');
      }

      throw error;
    }

    const user = await prisma.user.create({
      data: {
        email: body.email,
        username: body.username,
        passwordHash: hashPassword(body.password),
        displayName: body.displayName ?? body.username,
        role: 'USER',
      },
      select: authUserSelect,
    });

    return reply.code(201).send({
      user: serializeAuthUser(user),
    });
  });

  app.post('/user/login', async (request, reply) => {
    const body = loginBodySchema.parse(request.body);

    const user = await prisma.user.findUnique({
      where: { email: body.email },
      select: loginUserSelect,
    });

    if (!user || !verifyPassword(body.password, user.passwordHash)) {
      return reply.unauthorized('Invalid email or password');
    }

    if (user.status !== 'ACTIVE') {
      return reply.forbidden('User is disabled');
    }

    const { user: updatedUser, sessionToken } = await createSessionForUser(user.id);

    setSessionCookie(reply, sessionToken);

    return {
      user: serializeAuthUser(updatedUser),
    };
  });

  app.post('/user/password/forgot', async (request, reply) => {
    const body = forgotPasswordBodySchema.parse(request.body);
    const user = await prisma.user.findUnique({
      where: { email: body.email },
      select: {
        id: true,
        status: true,
      },
    });

    if (user?.status === 'ACTIVE') {
      const token = generatePasswordResetToken();
      await setPasswordResetToken(user.id, token);

      if (process.env.NODE_ENV === 'test') {
        reply.header('x-password-reset-token', token);
      }
    }

    return {
      success: true,
    };
  });

  app.post('/user/password/reset', async (request) => {
    const body = resetPasswordBodySchema.parse(request.body);
    const user = await prisma.user.findUnique({
      where: { email: body.email },
      select: {
        id: true,
        status: true,
        passwordResetTokenHash: true,
        passwordResetTokenExpiresAt: true,
      },
    });

    if (!user || user.status !== 'ACTIVE' || !canUsePasswordResetToken(user, body.token)) {
      throw app.httpErrors.badRequest('Password reset token is invalid or expired');
    }

    await updateUserPassword({
      userId: user.id,
      password: body.password,
    });

    return {
      success: true,
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

    const { sessionToken } = await createSessionForUser(currentUser.id);

    setSessionCookie(reply, sessionToken);

    return {
      accessToken: sessionToken,
    };
  });
};

export default authRoutes;
