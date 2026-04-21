import { randomUUID } from 'node:crypto';

import type { FastifyPluginAsync } from 'fastify';

import { relayEmbeddings } from './embeddings-service.js';
import { relayResponses } from './responses-service.js';
import { relayChatCompletion } from './service.js';
import { chatCompletionsBodySchema, embeddingsBodySchema, responsesBodySchema } from './types.js';

const relayRoutes: FastifyPluginAsync = async (app) => {
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
