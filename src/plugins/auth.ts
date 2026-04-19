import cookie from '@fastify/cookie';
import fp from 'fastify-plugin';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { verifyApiKey } from '../lib/crypto.js';
import { prisma } from '../lib/prisma.js';

const SESSION_COOKIE_NAME = 'nodew_session';
const BEARER_PREFIX = 'Bearer ';

type CurrentUser = {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  role: 'USER' | 'ADMIN';
  status: 'ACTIVE' | 'DISABLED';
};

type CurrentApiKey = {
  id: string;
  userId: string;
  keyPrefix: string;
  quotaRemaining: bigint | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
};

const resolveBearerToken = (authorization?: string) => {
  if (!authorization?.startsWith(BEARER_PREFIX)) {
    return null;
  }

  const token = authorization.slice(BEARER_PREFIX.length).trim();

  return token || null;
};

const authenticateApiKey = async (token: string) => {
  const keyPrefix = token.slice(0, 12);

  const apiKeys = await prisma.aPIKey.findMany({
    where: {
      keyPrefix,
      status: 'ACTIVE',
    },
    select: {
      id: true,
      userId: true,
      keyHash: true,
      keyPrefix: true,
      quotaRemaining: true,
      expiresAt: true,
      revokedAt: true,
      user: {
        select: {
          id: true,
          email: true,
          username: true,
          displayName: true,
          role: true,
          status: true,
        },
      },
    },
  });

  const matchedApiKey = apiKeys.find((apiKey) => verifyApiKey(token, apiKey.keyHash));

  if (!matchedApiKey || matchedApiKey.user.status !== 'ACTIVE') {
    return null;
  }

  if (matchedApiKey.revokedAt || (matchedApiKey.expiresAt && matchedApiKey.expiresAt <= new Date())) {
    return null;
  }

  return {
    user: matchedApiKey.user,
    apiKey: {
      id: matchedApiKey.id,
      userId: matchedApiKey.userId,
      keyPrefix: matchedApiKey.keyPrefix,
      quotaRemaining: matchedApiKey.quotaRemaining,
      expiresAt: matchedApiKey.expiresAt,
      revokedAt: matchedApiKey.revokedAt,
    } satisfies CurrentApiKey,
  };
};

const authenticateSession = async (request: FastifyRequest) => {
  const sessionCookie = request.cookies[SESSION_COOKIE_NAME];

  if (!sessionCookie) {
    request.currentUser = null;
    request.currentApiKey = null;
    return;
  }

  const { valid, value } = request.unsignCookie(sessionCookie);

  if (!valid) {
    request.currentUser = null;
    request.currentApiKey = null;
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
  request.currentApiKey = null;
};

declare module 'fastify' {
  interface FastifyRequest {
    currentUser: CurrentUser | null;
    currentApiKey: CurrentApiKey | null;
  }

  interface FastifyInstance {
    requireUser(request: FastifyRequest, reply: FastifyReply): Promise<void>;
    requireAdminUser(request: FastifyRequest, reply: FastifyReply): Promise<void>;
    requireRelayApiKey(request: FastifyRequest, reply: FastifyReply): Promise<void>;
  }
}

const authPlugin = fp(async (app) => {
  await app.register(cookie, {
    secret: process.env.SESSION_SECRET ?? 'nodew-dev-session-secret',
    hook: 'onRequest',
  });

  app.decorateRequest('currentUser', null);
  app.decorateRequest('currentApiKey', null);

  app.decorate('requireUser', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.currentUser) {
      return reply.unauthorized('Authentication required');
    }
  });

  app.decorate('requireAdminUser', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.currentUser) {
      return reply.unauthorized('Authentication required');
    }

    if (request.currentUser.role !== 'ADMIN') {
      return reply.forbidden('Administrator access required');
    }
  });

  app.decorate('requireRelayApiKey', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.currentUser || !request.currentApiKey) {
      return reply.unauthorized('API key required');
    }
  });

  app.addHook('onRequest', async (request) => {
    request.currentUser = null;
    request.currentApiKey = null;

    const bearerToken = resolveBearerToken(request.headers.authorization);

    if (bearerToken && request.url.startsWith('/v1/')) {
      const authenticated = await authenticateApiKey(bearerToken);

      if (!authenticated) {
        return;
      }

      request.currentUser = authenticated.user;
      request.currentApiKey = authenticated.apiKey;

      await prisma.aPIKey.update({
        where: { id: authenticated.apiKey.id },
        data: { lastUsedAt: new Date() },
      });

      return;
    }

    await authenticateSession(request);
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
