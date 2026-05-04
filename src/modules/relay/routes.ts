import { randomUUID } from 'node:crypto';

import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';

import { prisma } from '../../lib/prisma.js';
import { relayClaudeMessages } from './claude-service.js';
import { relayEmbeddings } from './embeddings-service.js';
import { relayGeminiGenerateContent } from './gemini-service.js';
import { getChannelSupportedModels } from './model-routing.js';
import { readMultipartField } from './multipart.js';
import { relayOpenAIJsonEndpoint, relayOpenAIMultipartEndpoint } from './openai-service.js';
import { relayResponses } from './responses-service.js';
import { relayChatCompletion } from './service.js';
import {
  chatCompletionsBodySchema,
  claudeMessagesBodySchema,
  completionsBodySchema,
  embeddingsBodySchema,
  isRelayStreamBody,
  type GeminiGenerateContentBody,
  modelOptionalBodySchema,
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

const getRequestId = (request: FastifyRequest) => {
  const requestId = request.headers['x-request-id'];

  return typeof requestId === 'string' && requestId ? requestId : randomUUID();
};

const applyRelayAttemptHeaders = (reply: FastifyReply, relayExecution: { attempts: Array<{ channelName: string }> }) => {
  if (relayExecution.attempts.length <= 1) {
    return;
  }

  reply.header('x-relay-attempts', relayExecution.attempts.length.toString());
  reply.header('x-relay-chain', relayExecution.attempts.map((attempt) => attempt.channelName).join(','));
};

const sendRelayResult = (reply: FastifyReply, relayExecution: { result: { statusCode: number; body: unknown; contentType?: string } }, stream: boolean | undefined) => {
  if (relayExecution.result.contentType) {
    reply.header('content-type', relayExecution.result.contentType);
  }

  if (stream && (typeof relayExecution.result.body === 'string' || isRelayStreamBody(relayExecution.result.body))) {
    reply.header('content-type', 'text/event-stream; charset=utf-8');
  }

  return reply.code(relayExecution.result.statusCode).send(relayExecution.result.body);
};

const getContentType = (request: FastifyRequest) => {
  const contentType = request.headers['content-type'];

  return typeof contentType === 'string' ? contentType : '';
};

const getMultipartBody = (request: FastifyRequest) => {
  if (Buffer.isBuffer(request.body)) {
    return request.body;
  }

  return null;
};

const getMultipartModel = (body: Buffer, contentType: string, fallbackModel: string) =>
  readMultipartField(body, contentType, 'model') ?? fallbackModel;

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

  applyRelayAttemptHeaders(reply, relayExecution);
  return sendRelayResult(reply, relayExecution, relayPath.endsWith(':streamGenerateContent'));
};

const relayRoutes: FastifyPluginAsync = async (app) => {
  app.addContentTypeParser(/^multipart\/form-data/i, { parseAs: 'buffer' }, (_request, body, done) => {
    done(null, body);
  });

  app.get('/models', {
    preHandler: app.requireRelayApiKey,
  }, async () => {
    const channels = await prisma.channel.findMany({
      where: {
        status: 'ACTIVE',
      },
      orderBy: [{ provider: 'asc' }, { name: 'asc' }],
      select: { model: true, metadata: true },
    });
    const models = [...new Set(channels.flatMap(getChannelSupportedModels))].sort();

    return {
      object: 'list',
      data: models
        .map((model) => ({
          id: model,
          object: 'model',
          created: 0,
          owned_by: 'nodew-api',
        })),
    };
  });

  app.get('/models/:model', {
    preHandler: app.requireRelayApiKey,
  }, async (request, reply) => {
    const model = typeof (request.params as { model?: unknown }).model === 'string'
      ? (request.params as { model: string }).model
      : '';

    const channels = await prisma.channel.findMany({
      where: {
        status: 'ACTIVE',
      },
      select: { model: true, metadata: true },
    });

    if (!channels.some((channel) => getChannelSupportedModels(channel).includes(model))) {
      return reply.code(404).send({
        error: {
          message: 'Model not found',
        },
      });
    }

    return {
      id: model,
      object: 'model',
      created: 0,
      owned_by: 'nodew-api',
    };
  });

  app.post('/models/:modelAction', {
    preHandler: app.requireRelayApiKey,
  }, async (request, reply) => handleGeminiRelay(request, reply));

  app.post('/messages', {
    preHandler: app.requireRelayApiKey,
  }, async (request, reply) => {
    const body = claudeMessagesBodySchema.parse(request.body);
    const anthropicVersionHeader = request.headers['anthropic-version'];
    const relayExecution = await relayClaudeMessages({
      userId: request.currentUser!.id,
      apiKeyId: request.currentApiKey!.id,
      requestId: getRequestId(request),
      body,
      anthropicVersion: typeof anthropicVersionHeader === 'string' ? anthropicVersionHeader : undefined,
    });

    applyRelayAttemptHeaders(reply, relayExecution);
    return sendRelayResult(reply, relayExecution, body.stream);
  });

  app.post('/chat/completions', {
    preHandler: app.requireRelayApiKey,
  }, async (request, reply) => {
    const body = chatCompletionsBodySchema.parse(request.body);
    const relayExecution = await relayChatCompletion({
      userId: request.currentUser!.id,
      apiKeyId: request.currentApiKey!.id,
      requestId: getRequestId(request),
      body,
    });

    applyRelayAttemptHeaders(reply, relayExecution);
    return sendRelayResult(reply, relayExecution, body.stream);
  });

  app.post('/completions', {
    preHandler: app.requireRelayApiKey,
  }, async (request, reply) => {
    const body = completionsBodySchema.parse(request.body);
    const relayExecution = await relayOpenAIJsonEndpoint({
      userId: request.currentUser!.id,
      apiKeyId: request.currentApiKey!.id,
      requestId: getRequestId(request),
      endpoint: '/v1/completions',
      upstreamPath: 'completions',
      model: body.model,
      body,
    });

    applyRelayAttemptHeaders(reply, relayExecution);
    return sendRelayResult(reply, relayExecution, body.stream);
  });

  app.post('/embeddings', {
    preHandler: app.requireRelayApiKey,
  }, async (request, reply) => {
    const body = embeddingsBodySchema.parse(request.body);
    const relayExecution = await relayEmbeddings({
      userId: request.currentUser!.id,
      apiKeyId: request.currentApiKey!.id,
      requestId: getRequestId(request),
      body,
    });

    applyRelayAttemptHeaders(reply, relayExecution);
    return reply.code(relayExecution.result.statusCode).send(relayExecution.result.body);
  });

  app.post('/responses', {
    preHandler: app.requireRelayApiKey,
  }, async (request, reply) => {
    const body = responsesBodySchema.parse(request.body);
    const relayExecution = await relayResponses({
      userId: request.currentUser!.id,
      apiKeyId: request.currentApiKey!.id,
      requestId: getRequestId(request),
      body,
    });

    applyRelayAttemptHeaders(reply, relayExecution);
    return sendRelayResult(reply, relayExecution, body.stream);
  });

  app.post('/images/generations', {
    preHandler: app.requireRelayApiKey,
  }, async (request, reply) => {
    const body = modelOptionalBodySchema.parse(request.body);
    const model = body.model ?? 'gpt-image-1';
    const relayExecution = await relayOpenAIJsonEndpoint({
      userId: request.currentUser!.id,
      apiKeyId: request.currentApiKey!.id,
      requestId: getRequestId(request),
      endpoint: '/v1/images/generations',
      upstreamPath: 'images/generations',
      model,
      body: { ...body, model },
    });

    applyRelayAttemptHeaders(reply, relayExecution);
    return reply.code(relayExecution.result.statusCode).send(relayExecution.result.body);
  });

  app.post('/moderations', {
    preHandler: app.requireRelayApiKey,
  }, async (request, reply) => {
    const body = modelOptionalBodySchema.parse(request.body);
    const model = body.model ?? 'omni-moderation-latest';
    const relayExecution = await relayOpenAIJsonEndpoint({
      userId: request.currentUser!.id,
      apiKeyId: request.currentApiKey!.id,
      requestId: getRequestId(request),
      endpoint: '/v1/moderations',
      upstreamPath: 'moderations',
      model,
      body: { ...body, model },
    });

    applyRelayAttemptHeaders(reply, relayExecution);
    return reply.code(relayExecution.result.statusCode).send(relayExecution.result.body);
  });

  app.post('/rerank', {
    preHandler: app.requireRelayApiKey,
  }, async (request, reply) => {
    const body = modelOptionalBodySchema.parse(request.body);
    const model = body.model ?? 'rerank-default';
    const relayExecution = await relayOpenAIJsonEndpoint({
      userId: request.currentUser!.id,
      apiKeyId: request.currentApiKey!.id,
      requestId: getRequestId(request),
      endpoint: '/v1/rerank',
      upstreamPath: 'rerank',
      model,
      body: { ...body, model },
    });

    applyRelayAttemptHeaders(reply, relayExecution);
    return reply.code(relayExecution.result.statusCode).send(relayExecution.result.body);
  });

  app.post('/audio/speech', {
    preHandler: app.requireRelayApiKey,
  }, async (request, reply) => {
    const body = modelOptionalBodySchema.parse(request.body);
    const model = body.model ?? 'tts-1';
    const relayExecution = await relayOpenAIJsonEndpoint({
      userId: request.currentUser!.id,
      apiKeyId: request.currentApiKey!.id,
      requestId: getRequestId(request),
      endpoint: '/v1/audio/speech',
      upstreamPath: 'audio/speech',
      model,
      body: { ...body, model },
    });

    applyRelayAttemptHeaders(reply, relayExecution);
    return sendRelayResult(reply, relayExecution, false);
  });

  app.post('/audio/transcriptions', {
    preHandler: app.requireRelayApiKey,
  }, async (request, reply) => {
    const contentType = getContentType(request);
    const body = getMultipartBody(request);

    if (!body || !contentType.includes('multipart/form-data')) {
      throw app.httpErrors.badRequest('multipart/form-data request body required');
    }

    const model = getMultipartModel(body, contentType, 'whisper-1');
    const relayExecution = await relayOpenAIMultipartEndpoint({
      userId: request.currentUser!.id,
      apiKeyId: request.currentApiKey!.id,
      requestId: getRequestId(request),
      endpoint: '/v1/audio/transcriptions',
      upstreamPath: 'audio/transcriptions',
      model,
      body,
      contentType,
    });

    applyRelayAttemptHeaders(reply, relayExecution);
    return sendRelayResult(reply, relayExecution, false);
  });

  app.post('/audio/translations', {
    preHandler: app.requireRelayApiKey,
  }, async (request, reply) => {
    const contentType = getContentType(request);
    const body = getMultipartBody(request);

    if (!body || !contentType.includes('multipart/form-data')) {
      throw app.httpErrors.badRequest('multipart/form-data request body required');
    }

    const model = getMultipartModel(body, contentType, 'whisper-1');
    const relayExecution = await relayOpenAIMultipartEndpoint({
      userId: request.currentUser!.id,
      apiKeyId: request.currentApiKey!.id,
      requestId: getRequestId(request),
      endpoint: '/v1/audio/translations',
      upstreamPath: 'audio/translations',
      model,
      body,
      contentType,
    });

    applyRelayAttemptHeaders(reply, relayExecution);
    return sendRelayResult(reply, relayExecution, false);
  });
};

export default relayRoutes;
