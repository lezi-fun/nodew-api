import { prisma } from '../../src/lib/prisma.js';
import { closeTestApp, createTestApp } from '../helpers/app.js';
import { createApiKey, createChannel, createUser } from '../helpers/factories.js';
import { mockFetchOnce, mockFetchSequence } from '../helpers/fetch.js';

describe('relay responses integration', () => {
  it('proxies an authenticated responses request and writes a usage log', async () => {
    const user = await createUser();
    const { apiKey } = await createApiKey(user.id);
    await createChannel({ name: 'Responses Channel', model: 'gpt-4.1-mini' });
    mockFetchOnce({
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: {
        id: 'resp_test',
        object: 'response',
        output: [
          {
            id: 'msg_1',
            type: 'message',
            role: 'assistant',
            content: [
              {
                type: 'output_text',
                text: 'responses ok',
              },
            ],
          },
        ],
        usage: {
          input_tokens: 11,
          output_tokens: 7,
          total_tokens: 18,
        },
      },
    });

    const app = await createTestApp();

    try {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/responses',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'x-request-id': 'relay-responses-request',
        },
        payload: {
          model: 'gpt-4.1-mini',
          input: 'hello responses',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().output[0].content[0].text).toBe('responses ok');

      const log = await prisma.usageLog.findUnique({
        where: { requestId: 'relay-responses-request' },
      });

      expect(log?.success).toBe(true);
      expect(log?.endpoint).toBe('/v1/responses');
      expect(log?.totalTokens).toBe(18);
    } finally {
      await closeTestApp(app);
    }
  });

  it('falls back to the next active channel after a retryable responses failure', async () => {
    const user = await createUser();
    const { apiKey } = await createApiKey(user.id);
    await createChannel({ name: 'Primary Responses Channel', model: 'gpt-4.1-mini', priority: 10 });
    await createChannel({ name: 'Fallback Responses Channel', model: 'gpt-4.1-mini', priority: 5 });
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
          id: 'resp_fallback',
          object: 'response',
          output: [
            {
              id: 'msg_1',
              type: 'message',
              role: 'assistant',
              content: [
                {
                  type: 'output_text',
                  text: 'fallback ok',
                },
              ],
            },
          ],
          usage: {
            input_tokens: 9,
            output_tokens: 4,
            total_tokens: 13,
          },
        },
      },
    ]);

    const app = await createTestApp();

    try {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/responses',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'x-request-id': 'relay-responses-fallback-request',
        },
        payload: {
          model: 'gpt-4.1-mini',
          input: 'retry me',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['x-relay-attempts']).toBe('2');
      expect(response.headers['x-relay-chain']).toBe('Primary Responses Channel,Fallback Responses Channel');
      expect(response.json().output[0].content[0].text).toBe('fallback ok');

      const log = await prisma.usageLog.findUnique({
        where: { requestId: 'relay-responses-fallback-request' },
      });

      expect(log?.success).toBe(true);
      expect(log?.errorMessage).toContain('fallback chain: Primary Responses Channel:500 -> Fallback Responses Channel:200');
    } finally {
      await closeTestApp(app);
    }
  });

  it('does not fall back when a responses error is non-retryable', async () => {
    const user = await createUser();
    const { apiKey } = await createApiKey(user.id);
    await createChannel({ name: 'Primary Responses Channel', model: 'gpt-4.1-mini', priority: 10 });
    await createChannel({ name: 'Fallback Responses Channel', model: 'gpt-4.1-mini', priority: 5 });
    const fetchMock = mockFetchSequence([
      {
        status: 400,
        headers: { 'content-type': 'application/json' },
        body: { error: { message: 'bad responses request' } },
      },
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: {
          id: 'resp_should_not_happen',
          object: 'response',
          output: [],
        },
      },
    ]);

    const app = await createTestApp();

    try {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/responses',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'x-request-id': 'relay-responses-non-retryable-request',
        },
        payload: {
          model: 'gpt-4.1-mini',
          input: 'bad input',
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.headers['x-relay-attempts']).toBeUndefined();
      expect(response.headers['x-relay-chain']).toBeUndefined();
      expect(response.json().error.message).toBe('bad responses request');
      expect(fetchMock).toHaveBeenCalledTimes(1);

      const log = await prisma.usageLog.findUnique({
        where: { requestId: 'relay-responses-non-retryable-request' },
      });

      expect(log?.success).toBe(false);
      expect(log?.statusCode).toBe(400);
      expect(log?.errorMessage).toBe('Primary Responses Channel:400');
    } finally {
      await closeTestApp(app);
    }
  });

  it('forwards stream responses as event streams and records zero-token usage', async () => {
    const user = await createUser();
    const { apiKey } = await createApiKey(user.id);
    await createChannel({ name: 'Responses Stream Channel', model: 'gpt-4.1-mini' });
    mockFetchOnce({
      status: 200,
      headers: { 'content-type': 'text/event-stream; charset=utf-8' },
      body: 'data: {"type":"response.output_text.delta","delta":"hello"}\n\ndata: [DONE]\n\n',
    });

    const app = await createTestApp();

    try {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/responses',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'x-request-id': 'relay-responses-stream-request',
        },
        payload: {
          model: 'gpt-4.1-mini',
          stream: true,
          input: 'hello stream',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/event-stream');
      expect(response.body).toContain('response.output_text.delta');
      expect(response.body).toContain('data: [DONE]');

      const log = await prisma.usageLog.findUnique({
        where: { requestId: 'relay-responses-stream-request' },
      });

      expect(log?.success).toBe(true);
      expect(log?.promptTokens).toBe(0);
      expect(log?.completionTokens).toBe(0);
      expect(log?.totalTokens).toBe(0);
    } finally {
      await closeTestApp(app);
    }
  });

  it('treats error event streams as failed upstream responses', async () => {
    const user = await createUser();
    const { apiKey } = await createApiKey(user.id);
    await createChannel({ name: 'Responses Error Stream Channel', model: 'gpt-4.1-mini' });
    mockFetchOnce({
      status: 200,
      headers: { 'content-type': 'text/event-stream; charset=utf-8' },
      body: 'event: error\ndata: "{"\n\n',
    });

    const app = await createTestApp();

    try {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/responses',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'x-request-id': 'relay-responses-error-stream-request',
        },
        payload: {
          model: 'gpt-4.1-mini',
          input: 'hello error stream',
        },
      });

      expect(response.statusCode).toBe(502);
      expect(response.json().error.message).toBe('{');

      const log = await prisma.usageLog.findUnique({
        where: { requestId: 'relay-responses-error-stream-request' },
      });

      expect(log?.success).toBe(false);
      expect(log?.statusCode).toBe(502);
      expect(log?.errorMessage).toBe('Responses Error Stream Channel:502');
    } finally {
      await closeTestApp(app);
    }
  });

  it('does not route responses to anthropic channels for the same model', async () => {
    const user = await createUser();
    const { apiKey } = await createApiKey(user.id);
    await createChannel({ name: 'Anthropic Channel', provider: 'anthropic', model: 'gpt-4.1-mini', priority: 100 });
    await createChannel({ name: 'OpenAI Responses Channel', provider: 'openai', model: 'gpt-4.1-mini', priority: 10 });
    const fetchMock = mockFetchOnce({
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: {
        id: 'resp_provider_boundary',
        object: 'response',
        output: [
          {
            id: 'msg_1',
            type: 'message',
            role: 'assistant',
            content: [
              {
                type: 'output_text',
                text: 'responses boundary ok',
              },
            ],
          },
        ],
        usage: {
          input_tokens: 6,
          output_tokens: 4,
          total_tokens: 10,
        },
      },
    });

    const app = await createTestApp();

    try {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/responses',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'x-request-id': 'relay-responses-provider-boundary-request',
        },
        payload: {
          model: 'gpt-4.1-mini',
          input: 'hello responses',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().output[0].content[0].text).toBe('responses boundary ok');
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0]?.[0]).toBe('https://example.test/v1/responses');

      const log = await prisma.usageLog.findUnique({
        where: { requestId: 'relay-responses-provider-boundary-request' },
      });

      expect(log?.success).toBe(true);
      expect(log?.provider).toBe('openai');
    } finally {
      await closeTestApp(app);
    }
  });
});
