import { prisma } from '../../src/lib/prisma.js';
import { closeTestApp, createTestApp } from '../helpers/app.js';
import { createApiKey, createChannel, createUser } from '../helpers/factories.js';
import { mockFetchOnce, mockFetchSequence } from '../helpers/fetch.js';

describe('relay claude integration', () => {
  it('accepts Claude auth headers, proxies a messages request, and writes a usage log', async () => {
    const user = await createUser();
    const { apiKey } = await createApiKey(user.id);
    await createChannel({ name: 'Anthropic Channel', provider: 'anthropic', model: 'claude-3-5-sonnet-latest' });
    const fetchMock = mockFetchOnce({
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: {
        id: 'msg_test',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'claude ok' }],
        usage: {
          input_tokens: 11,
          output_tokens: 7,
        },
      },
    });

    const app = await createTestApp();

    try {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/messages',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'x-request-id': 'relay-claude-request',
        },
        payload: {
          model: 'claude-3-5-sonnet-latest',
          max_tokens: 128,
          messages: [{ role: 'user', content: 'hello claude' }],
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().content[0].text).toBe('claude ok');
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0]?.[0]).toBe('https://example.test/v1/messages');
      expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
        method: 'POST',
        headers: expect.objectContaining({
          'x-api-key': 'channel-secret-key',
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        }),
      });

      const log = await prisma.usageLog.findUnique({
        where: { requestId: 'relay-claude-request' },
      });

      expect(log?.success).toBe(true);
      expect(log?.endpoint).toBe('/v1/messages');
      expect(log?.promptTokens).toBe(11);
      expect(log?.completionTokens).toBe(7);
      expect(log?.totalTokens).toBe(18);
    } finally {
      await closeTestApp(app);
    }
  });

  it('falls back to the next anthropic channel after a retryable failure', async () => {
    const user = await createUser();
    const { apiKey } = await createApiKey(user.id);
    await createChannel({ name: 'Primary Anthropic Channel', provider: 'anthropic', model: 'claude-3-5-sonnet-latest', priority: 10 });
    await createChannel({ name: 'Fallback Anthropic Channel', provider: 'anthropic', model: 'claude-3-5-sonnet-latest', priority: 5 });
    await createChannel({ name: 'OpenAI Channel', provider: 'openai', model: 'claude-3-5-sonnet-latest', priority: 100 });
    mockFetchSequence([
      {
        status: 529,
        headers: { 'content-type': 'application/json' },
        body: { error: { message: 'overloaded' } },
      },
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: {
          id: 'msg_fallback',
          type: 'message',
          role: 'assistant',
          content: [{ type: 'text', text: 'fallback ok' }],
          usage: {
            input_tokens: 4,
            output_tokens: 3,
          },
        },
      },
    ]);

    const app = await createTestApp();

    try {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/messages',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'x-request-id': 'relay-claude-fallback-request',
        },
        payload: {
          model: 'claude-3-5-sonnet-latest',
          max_tokens: 128,
          messages: [{ role: 'user', content: 'retry me' }],
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['x-relay-attempts']).toBe('2');
      expect(response.headers['x-relay-chain']).toBe('Primary Anthropic Channel,Fallback Anthropic Channel');
      expect(response.json().content[0].text).toBe('fallback ok');

      const log = await prisma.usageLog.findUnique({
        where: { requestId: 'relay-claude-fallback-request' },
      });

      expect(log?.success).toBe(true);
      expect(log?.errorMessage).toContain('fallback chain: Primary Anthropic Channel:529 -> Fallback Anthropic Channel:200');
    } finally {
      await closeTestApp(app);
    }
  });

  it('forwards Claude stream responses and records zero-token usage', async () => {
    const user = await createUser();
    const { apiKey } = await createApiKey(user.id);
    await createChannel({ name: 'Anthropic Stream Channel', provider: 'anthropic', model: 'claude-3-5-sonnet-latest' });
    mockFetchOnce({
      status: 200,
      headers: { 'content-type': 'text/event-stream; charset=utf-8' },
      body: 'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"hello"}}\n\nevent: message_stop\ndata: {"type":"message_stop"}\n\n',
    });

    const app = await createTestApp();

    try {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/messages',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'x-request-id': 'relay-claude-stream-request',
        },
        payload: {
          model: 'claude-3-5-sonnet-latest',
          stream: true,
          max_tokens: 128,
          messages: [{ role: 'user', content: 'hello stream' }],
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/event-stream');
      expect(response.body).toContain('content_block_delta');
      expect(response.body).toContain('message_stop');

      const log = await prisma.usageLog.findUnique({
        where: { requestId: 'relay-claude-stream-request' },
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
