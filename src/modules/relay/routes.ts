import { randomUUID } from 'node:crypto';

import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';

import { relayClaudeMessages } from './claude-service.js';
import { relayEmbeddings } from './embeddings-service.js';
import { relayGeminiGenerateContent } from './gemini-service.js';
import { relayResponses } from './responses-service.js';
import { relayChatCompletion } from './service.js';
import {
  chatCompletionsBodySchema,
  claudeMessagesBodySchema,
  embeddingsBodySchema,
  type GeminiGenerateContentBody,
  responsesBodySchema,
} from './types.js';

type GeminiRelayParams = {
  modelAction: string;
};

const getGeminiRelayParams = (request: FastifyRequest): GeminiRelayParams | null => {
  if (!request.params || typeof request.params !== 'object' || !('modelAction' in request.params)) {
    return null;
  }

  const modelAction = (request.params as { modelAction?: unknown }).modelAction;

  return typeof modelAction === 'string' && modelAction ? { modelAction } : null;
};

const buildGeminiRelayPath = (params: GeminiRelayParams) => `/models/${params.modelAction}`;
const isGeminiRelayPath = (path: string) => /^\/models\/[^/:]+:(generateContent|streamGenerateContent)$/.test(path);
const isGeminiRouteRequest = (request: FastifyRequest) => request.url.startsWith('/v1beta/');

const isGeminiGenerateContentBody = (body: unknown): body is GeminiGenerateContentBody => {
  if (!body || typeof body !== 'object' || !('contents' in body)) {
    return false;
  }

  return Array.isArray((body as { contents?: unknown }).contents);
};

const handleGeminiRelay = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  if (!isGeminiRouteRequest(request)) {
    throw request.server.httpErrors.notFound('Route not found');
  }

  const params = getGeminiRelayParams(request);

  if (!params) {
    throw request.server.httpErrors.notFound('Route not found');
  }

  const relayPath = buildGeminiRelayPath(params);

  if (!isGeminiRelayPath(relayPath)) {
    throw request.server.httpErrors.notFound('Route not found');
  }

  if (!isGeminiGenerateContentBody(request.body)) {
    throw request.server.httpErrors.badRequest('Invalid Gemini request body');
  }

  const requestId = request.headers['x-request-id'];
  const relayExecution = await relayGeminiGenerateContent({
    userId: request.currentUser!.id,
    apiKeyId: request.currentApiKey!.id,
    requestId: typeof requestId === 'string' && requestId ? requestId : randomUUID(),
    path: relayPath,
    body: request.body,
  });

  if (relayExecution.attempts.length > 1) {
    reply.header('x-relay-attempts', relayExecution.attempts.length.toString());
    reply.header('x-relay-chain', relayExecution.attempts.map((attempt) => attempt.channelName).join(','));
  }

  if (relayPath.endsWith(':streamGenerateContent') && typeof relayExecution.result.body === 'string') {
    reply.header('content-type', 'text/event-stream; charset=utf-8');
    return reply.code(relayExecution.result.statusCode).send(relayExecution.result.body);
  }

  return reply.code(relayExecution.result.statusCode).send(relayExecution.result.body);
};

const relayRoutes: FastifyPluginAsync = async (app) => {
  app.post('/models/:modelAction', {
    preHandler: app.requireRelayApiKey,
  }, async (request, reply) => handleGeminiRelay(request, reply));

  app.post('/messages', {
    preHandler: app.requireRelayApiKey,
  }, async (request, reply) => {
    const body = claudeMessagesBodySchema.parse(request.body);
    const requestId = request.headers['x-request-id'];
    const anthropicVersionHeader = request.headers['anthropic-version'];
    const relayExecution = await relayClaudeMessages({
      userId: request.currentUser!.id,
      apiKeyId: request.currentApiKey!.id,
      requestId: typeof requestId === 'string' && requestId ? requestId : randomUUID(),
      body,
      anthropicVersion: typeof anthropicVersionHeader === 'string' ? anthropicVersionHeader : undefined,
    });

    if (relayExecution.attempts.length > 1) {
      reply.header('x-relay-attempts', relayExecution.attempts.length.toString());
      reply.header('x-relay-chain', relayExecution.attempts.map((attempt) => attempt.channelName).join(','));
    }

    if (body.stream && typeof relayExecution.result.body === 'string') {
      reply.header('content-type', 'text/event-stream; charset=utf-8');
      return reply.code(relayExecution.result.statusCode).send(relayExecution.result.body);
    }

    return reply.code(relayExecution.result.statusCode).send(relayExecution.result.body);
  });

  app.post('/chat/completions', {
    preHandler: app.requireRelayApiKey,
  }, async (request, reply) => {
    const body = chatCompletionsBodySchema.parse(request.body);
    const requestId = request.headers['x-request-id'];
    const relayExecution = await relayChatCompletion({
      userId: request.currentUser!.id,
      apiKeyId: request.currentApiKey!.id,
      requestId: typeof requestId === 'string' && requestId ? requestId : randomUUID(),
      body,
    });

    if (relayExecution.attempts.length > 1) {
      reply.header('x-relay-attempts', relayExecution.attempts.length.toString());
      reply.header('x-relay-chain', relayExecution.attempts.map((attempt) => attempt.channelName).join(','));
    }

    if (body.stream && typeof relayExecution.result.body === 'string') {
      reply.header('content-type', 'text/event-stream; charset=utf-8');
      return reply.code(relayExecution.result.statusCode).send(relayExecution.result.body);
    }

    return reply.code(relayExecution.result.statusCode).send(relayExecution.result.body);
  });

  app.post('/embeddings', {
    preHandler: app.requireRelayApiKey,
  }, async (request, reply) => {
    const body = embeddingsBodySchema.parse(request.body);
    const requestId = request.headers['x-request-id'];
    const relayExecution = await relayEmbeddings({
      userId: request.currentUser!.id,
      apiKeyId: request.currentApiKey!.id,
      requestId: typeof requestId === 'string' && requestId ? requestId : randomUUID(),
      body,
    });

    if (relayExecution.attempts.length > 1) {
      reply.header('x-relay-attempts', relayExecution.attempts.length.toString());
      reply.header('x-relay-chain', relayExecution.attempts.map((attempt) => attempt.channelName).join(','));
    }

    return reply.code(relayExecution.result.statusCode).send(relayExecution.result.body);
  });

  app.post('/responses', {
    preHandler: app.requireRelayApiKey,
  }, async (request, reply) => {
    const body = responsesBodySchema.parse(request.body);
    const requestId = request.headers['x-request-id'];
    const relayExecution = await relayResponses({
      userId: request.currentUser!.id,
      apiKeyId: request.currentApiKey!.id,
      requestId: typeof requestId === 'string' && requestId ? requestId : randomUUID(),
      body,
    });

    if (relayExecution.attempts.length > 1) {
      reply.header('x-relay-attempts', relayExecution.attempts.length.toString());
      reply.header('x-relay-chain', relayExecution.attempts.map((attempt) => attempt.channelName).join(','));
    }

    if (body.stream && typeof relayExecution.result.body === 'string') {
      reply.header('content-type', 'text/event-stream; charset=utf-8');
      return reply.code(relayExecution.result.statusCode).send(relayExecution.result.body);
    }

    return reply.code(relayExecution.result.statusCode).send(relayExecution.result.body);
  });
};

export default relayRoutes;
