import cookie from '@fastify/cookie';
import fp from 'fastify-plugin';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { prisma } from '../lib/prisma.js';

const SESSION_COOKIE_NAME = 'nodew_session';

declare module 'fastify' {
  interface FastifyRequest {
    currentUser: {
      id: string;
      email: string;
      username: string;
      displayName: string | null;
      role: 'USER' | 'ADMIN';
      status: 'ACTIVE' | 'DISABLED';
    } | null;
  }

  interface FastifyInstance {
    requireUser(request: FastifyRequest, reply: FastifyReply): Promise<void>;
  }
}

const authPlugin = fp(async (app) => {
  await app.register(cookie, {
    secret: process.env.SESSION_SECRET ?? 'nodew-dev-session-secret',
    hook: 'onRequest',
  });

  app.decorateRequest('currentUser', null);

  app.decorate('requireUser', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.currentUser) {
      return reply.unauthorized('Authentication required');
    }
  });

  app.addHook('onRequest', async (request) => {
    const sessionCookie = request.cookies[SESSION_COOKIE_NAME];

    if (!sessionCookie) {
      request.currentUser = null;
      return;
    }

    const { valid, value } = request.unsignCookie(sessionCookie);

    if (!valid) {
      request.currentUser = null;
      return;
    }

    const user = await prisma.user.findFirst({
      where: {
        accessToken: value,
      },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        role: true,
        status: true,
      },
    });

    request.currentUser = user;
  });
});

export const setSessionCookie = (reply: FastifyReply, token: string) => {
  reply.setCookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    signed: true,
  });
};

export const clearSessionCookie = (reply: FastifyReply) => {
  reply.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    signed: true,
  });
};

export default authPlugin;
