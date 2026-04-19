import { randomUUID } from 'node:crypto';

import type { FastifyPluginAsync } from 'fastify';

import { relayChatCompletion } from './service.js';
import { chatCompletionsBodySchema } from './types.js';

const relayRoutes: FastifyPluginAsync = async (app) => {
  app.post('/chat/completions', {
    preHandler: app.requireRelayApiKey,
  }, async (request, reply) => {
    const body = chatCompletionsBodySchema.parse(request.body);

    if (body.stream) {
      throw app.httpErrors.badRequest('Streaming is not supported yet');
    }

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

    return reply.code(relayExecution.result.statusCode).send(relayExecution.result.body);
  });
};

export default relayRoutes;
