import cookie from '@fastify/cookie';
import fp from 'fastify-plugin';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { verifyApiKey } from '../lib/crypto.js';
import { prisma } from '../lib/prisma.js';
import { readMultipartField } from '../modules/relay/multipart.js';

const SESSION_COOKIE_NAME = 'nodew_session';
const BEARER_PREFIX = 'Bearer ';

type CurrentUser = {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  role: 'USER' | 'ADMIN';
  status: 'ACTIVE' | 'DISABLED';
  quotaRemaining: bigint;
  quotaUsed: bigint;
};

type CurrentApiKey = {
  id: string;
  userId: string;
  keyPrefix: string;
  quotaRemaining: bigint | null;
  metadata: unknown;
  expiresAt: Date | null;
  revokedAt: Date | null;
};

type TokenAccessMetadata = {
  allowedModels?: string[];
  blockedModels?: string[];
};

const resolveBearerToken = (authorization?: string) => {
  if (!authorization?.startsWith(BEARER_PREFIX)) {
    return null;
  }

  const token = authorization.slice(BEARER_PREFIX.length).trim();

  return token || null;
};

const resolveRelayApiToken = (request: FastifyRequest) => {
  const bearerToken = resolveBearerToken(request.headers.authorization);

  if (bearerToken) {
    return bearerToken;
  }

  const anthropicApiKeyHeader = request.headers['x-api-key'];

  if (typeof anthropicApiKeyHeader === 'string' && anthropicApiKeyHeader.trim()) {
    return anthropicApiKeyHeader.trim();
  }

  const geminiApiKeyHeader = request.headers['x-goog-api-key'];

  if (typeof geminiApiKeyHeader === 'string' && geminiApiKeyHeader.trim()) {
    return geminiApiKeyHeader.trim();
  }

  const rawUrl = request.raw.url ?? request.url;
  const queryKey = new URL(rawUrl, 'http://localhost').searchParams.get('key')?.trim();

  return queryKey || null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

const readStringList = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : undefined;

const readTokenAccessMetadata = (metadata: unknown): TokenAccessMetadata => {
  if (!isRecord(metadata)) {
    return {};
  }

  return {
    allowedModels: readStringList(metadata.allowedModels),
    blockedModels: readStringList(metadata.blockedModels),
  };
};

const wildcardToRegExp = (pattern: string) =>
  new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);

const modelMatches = (patterns: string[] | undefined, model: string) =>
  Boolean(patterns?.some((pattern) => wildcardToRegExp(pattern).test(model)));

const getContentType = (request: FastifyRequest) => {
  const contentType = request.headers['content-type'];

  return typeof contentType === 'string' ? contentType : '';
};

const getBodyModel = (body: unknown) => {
  if (isRecord(body) && typeof body.model === 'string' && body.model.trim()) {
    return body.model.trim();
  }

  return null;
};

const getRelayRequestedModel = (request: FastifyRequest) => {
  const bodyModel = getBodyModel(request.body);

  if (bodyModel) {
    return bodyModel;
  }

  if (Buffer.isBuffer(request.body)) {
    const model = readMultipartField(request.body, getContentType(request), 'model');

    if (model) {
      return model;
    }
  }

  const geminiModel = request.url.match(/^\/v1beta\/models\/([^:/?]+):/)?.[1];

  return geminiModel ?? null;
};

const isApiKeyAllowedForModel = (apiKey: CurrentApiKey, model: string | null) => {
  if (!model) {
    return true;
  }

  const metadata = readTokenAccessMetadata(apiKey.metadata);

  if (modelMatches(metadata.blockedModels, model)) {
    return false;
  }

  if (metadata.allowedModels && metadata.allowedModels.length > 0 && !modelMatches(metadata.allowedModels, model)) {
    return false;
  }

  return true;
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
      metadata: true,
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
          quotaRemaining: true,
          quotaUsed: true,
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
      metadata: matchedApiKey.metadata,
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
      quotaRemaining: true,
      quotaUsed: true,
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

    if (request.currentUser.quotaRemaining <= 0n) {
      return reply.code(402).send({
        statusCode: 402,
        error: 'Payment Required',
        message: 'User quota exhausted',
      });
    }

    if (request.currentApiKey.quotaRemaining !== null && request.currentApiKey.quotaRemaining <= 0n) {
      return reply.code(402).send({
        statusCode: 402,
        error: 'Payment Required',
        message: 'API key quota exhausted',
      });
    }

    const requestedModel = getRelayRequestedModel(request);

    if (!isApiKeyAllowedForModel(request.currentApiKey, requestedModel)) {
      return reply.code(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: requestedModel
          ? `API key is not allowed to access model ${requestedModel}`
          : 'API key is not allowed to access this model',
      });
    }
  });

  app.addHook('onRequest', async (request) => {
    request.currentUser = null;
    request.currentApiKey = null;

    const relayApiToken = (request.url.startsWith('/v1/') || request.url.startsWith('/v1beta/'))
      ? resolveRelayApiToken(request)
      : null;

    if (relayApiToken) {
      const authenticated = await authenticateApiKey(relayApiToken);

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
