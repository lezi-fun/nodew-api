import { prisma } from '../../src/lib/prisma.js';
import { closeTestApp, createTestApp } from '../helpers/app.js';
import { createApiKey, createChannel, createUser } from '../helpers/factories.js';
import { mockFetchOnce, mockFetchSequence } from '../helpers/fetch.js';

describe('relay integration', () => {
  it('rejects requests without a relay API key', async () => {
    const app = await createTestApp();

    try {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/chat/completions',
        payload: {
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'hello' }],
        },
      });

      expect(response.statusCode).toBe(401);
    } finally {
      await closeTestApp(app);
    }
  });

  it('proxies an authenticated relay request and writes a usage log', async () => {
    const user = await createUser();
    const { apiKey } = await createApiKey(user.id);
    await createChannel();
    mockFetchOnce({
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: {
        id: 'chatcmpl_test',
        object: 'chat.completion',
        usage: {
          prompt_tokens: 3,
          completion_tokens: 2,
          total_tokens: 5,
        },
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'relay ok' },
            finish_reason: 'stop',
          },
        ],
      },
    });

    const app = await createTestApp();

    try {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/chat/completions',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'x-request-id': 'relay-test-request',
        },
        payload: {
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'hello' }],
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().choices[0].message.content).toBe('relay ok');

      const log = await prisma.usageLog.findUnique({
        where: { requestId: 'relay-test-request' },
      });

      expect(log).not.toBeNull();
      expect(log?.success).toBe(true);
      expect(log?.totalTokens).toBe(5);
      expect(log?.endpoint).toBe('/v1/chat/completions');
    } finally {
      await closeTestApp(app);
    }
  });

  it('falls back to the next active channel after a retryable upstream failure', async () => {
    const user = await createUser();
    const { apiKey } = await createApiKey(user.id);
    await createChannel({ name: 'Primary Channel', priority: 10 });
    await createChannel({ name: 'Fallback Channel', priority: 5 });
    mockFetchSequence([
      {
        status: 500,
        headers: { 'content-type': 'application/json' },
        body: { error: { message: 'primary failed' } },
      },
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: {
          id: 'chatcmpl_fallback',
          object: 'chat.completion',
          usage: {
            prompt_tokens: 4,
            completion_tokens: 1,
            total_tokens: 5,
          },
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: 'fallback ok' },
              finish_reason: 'stop',
            },
          ],
        },
      },
    ]);

    const app = await createTestApp();

    try {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/chat/completions',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'x-request-id': 'relay-fallback-request',
        },
        payload: {
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'hello' }],
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['x-relay-attempts']).toBe('2');
      expect(response.headers['x-relay-chain']).toBe('Primary Channel,Fallback Channel');
      expect(response.json().choices[0].message.content).toBe('fallback ok');

      const log = await prisma.usageLog.findUnique({
        where: { requestId: 'relay-fallback-request' },
      });

      expect(log?.success).toBe(true);
      expect(log?.errorMessage).toContain('fallback chain: Primary Channel:500 -> Fallback Channel:200');
    } finally {
      await closeTestApp(app);
    }
  });

  it('records a failed relay when all retryable attempts fail', async () => {
    const user = await createUser();
    const { apiKey } = await createApiKey(user.id);
    await createChannel({ name: 'Primary Channel', priority: 10 });
    await createChannel({ name: 'Fallback Channel', priority: 5 });
    mockFetchSequence([
      {
        status: 500,
        headers: { 'content-type': 'application/json' },
        body: { error: { message: 'primary failed' } },
      },
      {
        status: 429,
        headers: { 'content-type': 'application/json' },
        body: { error: { message: 'rate limited' } },
      },
    ]);

    const app = await createTestApp();

    try {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/chat/completions',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'x-request-id': 'relay-failure-request',
        },
        payload: {
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'hello' }],
        },
      });

      expect(response.statusCode).toBe(429);
      expect(response.headers['x-relay-attempts']).toBe('2');
      expect(response.headers['x-relay-chain']).toBe('Primary Channel,Fallback Channel');
      expect(response.json().error.message).toBe('rate limited');

      const log = await prisma.usageLog.findUnique({
        where: { requestId: 'relay-failure-request' },
      });

      expect(log?.success).toBe(false);
      expect(log?.statusCode).toBe(429);
      expect(log?.errorMessage).toBe('Primary Channel:500 -> Fallback Channel:429');
    } finally {
      await closeTestApp(app);
    }
  });

  it('forwards stream responses as event streams and records zero-token usage', async () => {
    const user = await createUser();
    const { apiKey } = await createApiKey(user.id);
    await createChannel();
    mockFetchOnce({
      status: 200,
      headers: { 'content-type': 'text/event-stream; charset=utf-8' },
      body: 'data: {"choices":[{"delta":{"content":"hello"}}]}\n\ndata: [DONE]\n\n',
    });

    const app = await createTestApp();

    try {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/chat/completions',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'x-request-id': 'relay-stream-request',
        },
        payload: {
          model: 'gpt-4o-mini',
          stream: true,
          messages: [{ role: 'user', content: 'hello' }],
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/event-stream');
      expect(response.body).toContain('data: {"choices"');
      expect(response.body).toContain('data: [DONE]');

      const log = await prisma.usageLog.findUnique({
        where: { requestId: 'relay-stream-request' },
      });

      expect(log?.success).toBe(true);
      expect(log?.promptTokens).toBe(0);
      expect(log?.completionTokens).toBe(0);
      expect(log?.totalTokens).toBe(0);
    } finally {
      await closeTestApp(app);
    }
  });
});
