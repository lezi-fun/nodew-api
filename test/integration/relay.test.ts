import { prisma } from '../../src/lib/prisma.js';
import { closeTestApp, createTestApp } from '../helpers/app.js';
import { createApiKey, createChannel, createUser } from '../helpers/factories.js';
import { mockFetchOnce, mockFetchSequence } from '../helpers/fetch.js';

const buildMultipartBody = (boundary: string, fields: Record<string, string>) => Buffer.from([
  ...Object.entries(fields).flatMap(([name, value]) => [
    `--${boundary}`,
    `Content-Disposition: form-data; name="${name}"`,
    '',
    value,
  ]),
  `--${boundary}`,
  'Content-Disposition: form-data; name="file"; filename="audio.wav"',
  'Content-Type: audio/wav',
  '',
  'fake-audio',
  `--${boundary}--`,
  '',
].join('\r\n'));

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

  it('rejects requests with an invalid relay API key', async () => {
    const app = await createTestApp();

    try {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/chat/completions',
        headers: {
          authorization: 'Bearer sk-invalid-token',
        },
        payload: {
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'hello' }],
        },
      });

      expect(response.statusCode).toBe(401);
      expect(response.json().message).toBe('API key required');
    } finally {
      await closeTestApp(app);
    }
  });

  it('rejects relay requests when the user quota is exhausted', async () => {
    const user = await createUser({ quotaRemaining: 0n });
    const { apiKey } = await createApiKey(user.id);
    const app = await createTestApp();

    try {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/chat/completions',
        headers: {
          authorization: `Bearer ${apiKey}`,
        },
        payload: {
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'hello' }],
        },
      });

      expect(response.statusCode).toBe(402);
      expect(response.json().message).toBe('User quota exhausted');
    } finally {
      await closeTestApp(app);
    }
  });

  it('rejects relay requests when the API key quota is exhausted', async () => {
    const user = await createUser({ quotaRemaining: 100n });
    const { apiKey } = await createApiKey(user.id, { quotaRemaining: 0n });
    const app = await createTestApp();

    try {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/chat/completions',
        headers: {
          authorization: `Bearer ${apiKey}`,
        },
        payload: {
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'hello' }],
        },
      });

      expect(response.statusCode).toBe(402);
      expect(response.json().message).toBe('API key quota exhausted');
    } finally {
      await closeTestApp(app);
    }
  });

  it('enforces API key allowed model metadata before relay execution', async () => {
    const user = await createUser();
    const { apiKey } = await createApiKey(user.id, {
      metadata: {
        allowedModels: ['gpt-allowed'],
      },
    });
    await createChannel({ model: 'gpt-allowed' });
    const fetchMock = mockFetchOnce({
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: {
        id: 'chatcmpl_allowed_model',
        object: 'chat.completion',
        choices: [{ index: 0, message: { role: 'assistant', content: 'allowed' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      },
    });
    const app = await createTestApp();

    try {
      const deniedResponse = await app.inject({
        method: 'POST',
        url: '/v1/chat/completions',
        headers: {
          authorization: `Bearer ${apiKey}`,
        },
        payload: {
          model: 'gpt-denied',
          messages: [{ role: 'user', content: 'hello' }],
        },
      });
      const allowedResponse = await app.inject({
        method: 'POST',
        url: '/v1/chat/completions',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'x-request-id': 'relay-token-allowed-model',
        },
        payload: {
          model: 'gpt-allowed',
          messages: [{ role: 'user', content: 'hello' }],
        },
      });

      expect(deniedResponse.statusCode).toBe(403);
      expect(deniedResponse.json().message).toBe('API key is not allowed to access model gpt-denied');
      expect(allowedResponse.statusCode).toBe(200);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      await closeTestApp(app);
    }
  });

  it('enforces API key blocked model wildcard metadata', async () => {
    const user = await createUser();
    const { apiKey } = await createApiKey(user.id, {
      metadata: {
        blockedModels: ['gpt-*'],
      },
    });
    const app = await createTestApp();

    try {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/chat/completions',
        headers: {
          authorization: `Bearer ${apiKey}`,
        },
        payload: {
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'hello' }],
        },
      });

      expect(response.statusCode).toBe(403);
      expect(response.json().message).toBe('API key is not allowed to access model gpt-4o-mini');
    } finally {
      await closeTestApp(app);
    }
  });

  it('returns a failure when no active channel is available for the requested model', async () => {
    const user = await createUser();
    const { apiKey } = await createApiKey(user.id);
    const app = await createTestApp();

    try {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/chat/completions',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'x-request-id': 'relay-no-channel-request',
        },
        payload: {
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'hello' }],
        },
      });

      expect(response.statusCode).toBe(503);
      expect(response.json().error.message).toBe('No active channel available for the requested model');

      const log = await prisma.usageLog.findUnique({
        where: { requestId: 'relay-no-channel-request' },
      });

      expect(log?.success).toBe(false);
      expect(log?.provider).toBe('openai');
      expect(log?.statusCode).toBe(503);
      expect(log?.channelId).toBeNull();
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

  it('deducts user and token quota and records estimated cost for successful relay usage', async () => {
    const user = await createUser({ quotaRemaining: 100n });
    const { apiKey, record } = await createApiKey(user.id, { quotaRemaining: 50n });
    await createChannel({
      metadata: {
        costPerMillionTokensCents: 1_000_000,
        quotaMultiplier: 2,
      },
    });
    mockFetchOnce({
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: {
        id: 'chatcmpl_billing',
        object: 'chat.completion',
        usage: {
          prompt_tokens: 3,
          completion_tokens: 2,
          total_tokens: 5,
        },
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'billing ok' },
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
          'x-request-id': 'relay-billing-request',
        },
        payload: {
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'hello' }],
        },
      });

      expect(response.statusCode).toBe(200);

      const log = await prisma.usageLog.findUnique({
        where: { requestId: 'relay-billing-request' },
      });
      const storedUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { quotaRemaining: true, quotaUsed: true },
      });
      const storedApiKey = await prisma.aPIKey.findUnique({
        where: { id: record.id },
        select: { quotaRemaining: true },
      });

      expect(log?.estimatedCostCents).toBe(5);
      expect(storedUser?.quotaRemaining).toBe(90n);
      expect(storedUser?.quotaUsed).toBe(10n);
      expect(storedApiKey?.quotaRemaining).toBe(40n);
    } finally {
      await closeTestApp(app);
    }
  });

  it('proxies legacy completions through the generic OpenAI relay path', async () => {
    const user = await createUser();
    const { apiKey } = await createApiKey(user.id);
    await createChannel({ model: 'gpt-3.5-turbo-instruct' });
    const fetchMock = mockFetchOnce({
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: {
        id: 'cmpl_test',
        object: 'text_completion',
        choices: [{ text: 'completion ok', index: 0, finish_reason: 'stop' }],
        usage: {
          prompt_tokens: 2,
          completion_tokens: 3,
          total_tokens: 5,
        },
      },
    });

    const app = await createTestApp();

    try {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/completions',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'x-request-id': 'relay-completions-request',
        },
        payload: {
          model: 'gpt-3.5-turbo-instruct',
          prompt: 'hello',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(fetchMock.mock.calls[0]?.[0]).toBe('https://example.test/v1/completions');
      expect(response.json().choices[0].text).toBe('completion ok');

      const log = await prisma.usageLog.findUnique({
        where: { requestId: 'relay-completions-request' },
      });

      expect(log?.endpoint).toBe('/v1/completions');
      expect(log?.totalTokens).toBe(5);
    } finally {
      await closeTestApp(app);
    }
  });

  it('routes metadata model lists and maps requested models to upstream models', async () => {
    const user = await createUser();
    const { apiKey } = await createApiKey(user.id);
    await createChannel({
      name: 'Mapped Model Channel',
      model: null,
      metadata: {
        models: ['public-chat-model'],
        modelMap: {
          'public-chat-model': 'upstream-chat-model',
        },
      },
    });
    const fetchMock = mockFetchOnce({
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: {
        id: 'chatcmpl_mapped',
        object: 'chat.completion',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'mapped ok' },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 1,
          completion_tokens: 2,
          total_tokens: 3,
        },
      },
    });

    const app = await createTestApp();

    try {
      const modelsResponse = await app.inject({
        method: 'GET',
        url: '/v1/models',
        headers: {
          authorization: `Bearer ${apiKey}`,
        },
      });
      const response = await app.inject({
        method: 'POST',
        url: '/v1/chat/completions',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'x-request-id': 'relay-model-map-request',
        },
        payload: {
          model: 'public-chat-model',
          messages: [{ role: 'user', content: 'hello' }],
        },
      });

      expect(modelsResponse.statusCode).toBe(200);
      expect(modelsResponse.json().data.map((model: { id: string }) => model.id)).toContain('public-chat-model');
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string).model).toBe('upstream-chat-model');

      const log = await prisma.usageLog.findUnique({
        where: { requestId: 'relay-model-map-request' },
      });

      expect(log?.model).toBe('public-chat-model');
      expect(log?.totalTokens).toBe(3);
    } finally {
      await closeTestApp(app);
    }
  });

  it('proxies OpenAI speech responses with the upstream content type', async () => {
    const user = await createUser();
    const { apiKey } = await createApiKey(user.id);
    await createChannel({ model: 'tts-1' });
    const fetchMock = mockFetchOnce({
      status: 200,
      headers: { 'content-type': 'audio/mpeg' },
      body: 'fake-audio-bytes',
    });
    const app = await createTestApp();

    try {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/audio/speech',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'x-request-id': 'relay-audio-speech-request',
        },
        payload: {
          model: 'tts-1',
          input: 'hello',
          voice: 'alloy',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('audio/mpeg');
      expect(response.body).toBe('fake-audio-bytes');
      expect(fetchMock.mock.calls[0]?.[0]).toBe('https://example.test/v1/audio/speech');

      const log = await prisma.usageLog.findUnique({
        where: { requestId: 'relay-audio-speech-request' },
      });

      expect(log?.success).toBe(true);
      expect(log?.endpoint).toBe('/v1/audio/speech');
    } finally {
      await closeTestApp(app);
    }
  });

  it('proxies audio transcriptions as multipart and maps the model field', async () => {
    const user = await createUser();
    const { apiKey } = await createApiKey(user.id);
    await createChannel({
      model: null,
      metadata: {
        models: ['public-whisper'],
        modelMap: {
          'public-whisper': 'whisper-1',
        },
      },
    });
    const fetchMock = mockFetchOnce({
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: {
        text: 'hello world',
        usage: {
          input_tokens: 4,
          output_tokens: 0,
          total_tokens: 4,
        },
      },
    });
    const boundary = 'nodew-test-boundary';
    const app = await createTestApp();

    try {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/audio/transcriptions',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'content-type': `multipart/form-data; boundary=${boundary}`,
          'x-request-id': 'relay-audio-transcriptions-request',
        },
        payload: buildMultipartBody(boundary, {
          model: 'public-whisper',
          response_format: 'json',
        }),
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().text).toBe('hello world');
      expect(fetchMock.mock.calls[0]?.[0]).toBe('https://example.test/v1/audio/transcriptions');
      expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({
        authorization: 'Bearer channel-secret-key',
        'content-type': `multipart/form-data; boundary=${boundary}`,
      });
      expect(Buffer.from(fetchMock.mock.calls[0]?.[1]?.body as Buffer).toString()).toContain('\r\nwhisper-1\r\n');

      const log = await prisma.usageLog.findUnique({
        where: { requestId: 'relay-audio-transcriptions-request' },
      });

      expect(log?.endpoint).toBe('/v1/audio/transcriptions');
      expect(log?.model).toBe('public-whisper');
      expect(log?.totalTokens).toBe(4);
    } finally {
      await closeTestApp(app);
    }
  });

  it('inserts the default whisper model for audio translations when the multipart field is missing', async () => {
    const user = await createUser();
    const { apiKey } = await createApiKey(user.id);
    await createChannel({ model: 'whisper-1' });
    const fetchMock = mockFetchOnce({
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: {
        text: 'translated text',
      },
    });
    const boundary = 'nodew-test-translation-boundary';
    const app = await createTestApp();

    try {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/audio/translations',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'content-type': `multipart/form-data; boundary=${boundary}`,
          'x-request-id': 'relay-audio-translations-request',
        },
        payload: buildMultipartBody(boundary, {
          response_format: 'json',
        }),
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().text).toBe('translated text');
      expect(fetchMock.mock.calls[0]?.[0]).toBe('https://example.test/v1/audio/translations');
      expect(Buffer.from(fetchMock.mock.calls[0]?.[1]?.body as Buffer).toString()).toContain('name="model"\r\n\r\nwhisper-1');

      const log = await prisma.usageLog.findUnique({
        where: { requestId: 'relay-audio-translations-request' },
      });

      expect(log?.endpoint).toBe('/v1/audio/translations');
      expect(log?.model).toBe('whisper-1');
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

  it('skips a channel that exceeded its per-minute relay limit and falls back', async () => {
    const user = await createUser();
    const { apiKey } = await createApiKey(user.id);
    await createChannel({ name: 'Limited Primary Channel', priority: 10, rateLimitPerMin: 1 });
    await createChannel({ name: 'Rate Limit Fallback Channel', priority: 5 });
    const fetchMock = mockFetchSequence([
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: {
          id: 'chatcmpl_rate_limit_first',
          object: 'chat.completion',
          choices: [{ index: 0, message: { role: 'assistant', content: 'first ok' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        },
      },
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: {
          id: 'chatcmpl_rate_limit_fallback',
          object: 'chat.completion',
          choices: [{ index: 0, message: { role: 'assistant', content: 'fallback ok' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 2, completion_tokens: 1, total_tokens: 3 },
        },
      },
    ]);
    const app = await createTestApp();

    try {
      const firstResponse = await app.inject({
        method: 'POST',
        url: '/v1/chat/completions',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'x-request-id': 'relay-channel-rate-limit-first',
        },
        payload: {
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'hello' }],
        },
      });
      const secondResponse = await app.inject({
        method: 'POST',
        url: '/v1/chat/completions',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'x-request-id': 'relay-channel-rate-limit-fallback',
        },
        payload: {
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'hello again' }],
        },
      });

      expect(firstResponse.statusCode).toBe(200);
      expect(secondResponse.statusCode).toBe(200);
      expect(secondResponse.headers['x-relay-attempts']).toBe('2');
      expect(secondResponse.headers['x-relay-chain']).toBe('Limited Primary Channel,Rate Limit Fallback Channel');
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock.mock.calls[0]?.[0]).toBe('https://example.test/v1/chat/completions');
      expect(fetchMock.mock.calls[1]?.[0]).toBe('https://example.test/v1/chat/completions');

      const log = await prisma.usageLog.findUnique({
        where: { requestId: 'relay-channel-rate-limit-fallback' },
      });

      expect(log?.success).toBe(true);
      expect(log?.errorMessage).toContain('fallback chain: Limited Primary Channel:429 -> Rate Limit Fallback Channel:200');
      expect(log?.totalTokens).toBe(3);
    } finally {
      await closeTestApp(app);
    }
  });

  it('returns 429 and records a failed relay when all matching channels are rate limited', async () => {
    const user = await createUser();
    const { apiKey } = await createApiKey(user.id);
    await createChannel({ name: 'Only Limited Channel', rateLimitPerMin: 1 });
    const fetchMock = mockFetchOnce({
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: {
        id: 'chatcmpl_rate_limit_only_first',
        object: 'chat.completion',
        choices: [{ index: 0, message: { role: 'assistant', content: 'first ok' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      },
    });
    const app = await createTestApp();

    try {
      const firstResponse = await app.inject({
        method: 'POST',
        url: '/v1/chat/completions',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'x-request-id': 'relay-all-rate-limited-first',
        },
        payload: {
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'hello' }],
        },
      });
      const secondResponse = await app.inject({
        method: 'POST',
        url: '/v1/chat/completions',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'x-request-id': 'relay-all-rate-limited-second',
        },
        payload: {
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'hello again' }],
        },
      });

      expect(firstResponse.statusCode).toBe(200);
      expect(secondResponse.statusCode).toBe(429);
      expect(secondResponse.json().error.message).toBe('All matching relay channels are rate limited');
      expect(fetchMock).toHaveBeenCalledTimes(1);

      const log = await prisma.usageLog.findUnique({
        where: { requestId: 'relay-all-rate-limited-second' },
      });

      expect(log?.success).toBe(false);
      expect(log?.statusCode).toBe(429);
      expect(log?.errorMessage).toBe('Only Limited Channel:429');
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

  it('auto-disables a channel after consecutive relay health failures', async () => {
    const user = await createUser();
    const { apiKey } = await createApiKey(user.id);
    const channel = await createChannel({
      name: 'Auto Disable Channel',
      metadata: {
        autoDisableFailureThreshold: 2,
      },
    });
    mockFetchSequence([
      {
        status: 500,
        headers: { 'content-type': 'application/json' },
        body: { error: { message: 'first upstream failure' } },
      },
      {
        status: 500,
        headers: { 'content-type': 'application/json' },
        body: { error: { message: 'second upstream failure' } },
      },
    ]);
    const app = await createTestApp();

    try {
      const firstResponse = await app.inject({
        method: 'POST',
        url: '/v1/chat/completions',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'x-request-id': 'relay-auto-disable-first',
        },
        payload: {
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'hello' }],
        },
      });
      const secondResponse = await app.inject({
        method: 'POST',
        url: '/v1/chat/completions',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'x-request-id': 'relay-auto-disable-second',
        },
        payload: {
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'hello again' }],
        },
      });

      expect(firstResponse.statusCode).toBe(500);
      expect(secondResponse.statusCode).toBe(500);

      const stored = await prisma.channel.findUnique({
        where: { id: channel.id },
        select: { status: true, metadata: true },
      });

      expect(stored?.status).toBe('DISABLED');
      expect(stored?.metadata).toMatchObject({
        autoDisableFailureThreshold: 2,
        relayHealth: {
          failureCount: 2,
          lastFailureStatusCode: 500,
          lastFailureMessage: 'second upstream failure',
          disabledReason: 'relay_failure_threshold',
        },
      });
    } finally {
      await closeTestApp(app);
    }
  });

  it('clears relay health failure count after a successful channel response', async () => {
    const user = await createUser();
    const { apiKey } = await createApiKey(user.id);
    const channel = await createChannel({
      name: 'Recovering Channel',
      metadata: {
        relayHealth: {
          failureCount: 2,
          lastFailureStatusCode: 500,
        },
      },
    });
    mockFetchOnce({
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: {
        id: 'chatcmpl_recovered',
        object: 'chat.completion',
        choices: [{ index: 0, message: { role: 'assistant', content: 'recovered' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      },
    });
    const app = await createTestApp();

    try {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/chat/completions',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'x-request-id': 'relay-health-recovered',
        },
        payload: {
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'hello' }],
        },
      });

      expect(response.statusCode).toBe(200);

      const stored = await prisma.channel.findUnique({
        where: { id: channel.id },
        select: { metadata: true },
      });

      expect(stored?.metadata).toMatchObject({
        relayHealth: {
          failureCount: 0,
        },
      });
      expect((stored?.metadata as { relayHealth?: { lastSuccessAt?: string } }).relayHealth?.lastSuccessAt).toEqual(expect.any(String));
    } finally {
      await closeTestApp(app);
    }
  });

  it('does not route chat completions to anthropic channels for the same model', async () => {
    const user = await createUser();
    const { apiKey } = await createApiKey(user.id);
    await createChannel({ name: 'Anthropic Channel', provider: 'anthropic', model: 'gpt-4o-mini', priority: 100 });
    await createChannel({ name: 'OpenAI Channel', provider: 'openai', model: 'gpt-4o-mini', priority: 10 });
    const fetchMock = mockFetchOnce({
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: {
        id: 'chatcmpl_provider_boundary',
        object: 'chat.completion',
        usage: {
          prompt_tokens: 3,
          completion_tokens: 2,
          total_tokens: 5,
        },
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'provider boundary ok' },
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
          'x-request-id': 'relay-provider-boundary-request',
        },
        payload: {
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'hello' }],
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().choices[0].message.content).toBe('provider boundary ok');
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0]?.[0]).toBe('https://example.test/v1/chat/completions');

      const log = await prisma.usageLog.findUnique({
        where: { requestId: 'relay-provider-boundary-request' },
      });

      expect(log?.success).toBe(true);
      expect(log?.provider).toBe('openai');
      expect(log?.channelId).not.toBeNull();
    } finally {
      await closeTestApp(app);
    }
  });

  it('routes OpenAI-compatible providers through the OpenAI relay pipeline', async () => {
    const user = await createUser();
    const { apiKey } = await createApiKey(user.id);
    await createChannel({
      name: 'DeepSeek Channel',
      provider: 'deepseek',
      baseUrl: null,
      model: 'deepseek-chat',
      metadata: {
        headers: {
          'x-provider-trace': 'enabled',
          authorization: 'should-not-override',
        },
      },
    });
    const fetchMock = mockFetchOnce({
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: {
        id: 'chatcmpl_deepseek',
        object: 'chat.completion',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'deepseek ok' },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 2,
          completion_tokens: 2,
          total_tokens: 4,
        },
      },
    });

    const app = await createTestApp();

    try {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/chat/completions',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'x-request-id': 'relay-openai-compatible-provider-request',
        },
        payload: {
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: 'hello' }],
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().choices[0].message.content).toBe('deepseek ok');
      expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.deepseek.com/v1/chat/completions');
      expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({
        authorization: 'Bearer channel-secret-key',
        'x-provider-trace': 'enabled',
      });

      const log = await prisma.usageLog.findUnique({
        where: { requestId: 'relay-openai-compatible-provider-request' },
      });

      expect(log?.provider).toBe('deepseek');
      expect(log?.totalTokens).toBe(4);
    } finally {
      await closeTestApp(app);
    }
  });

  it('does not fall back when the upstream error is non-retryable', async () => {
    const user = await createUser();
    const { apiKey } = await createApiKey(user.id);
    await createChannel({ name: 'Primary Channel', priority: 10 });
    await createChannel({ name: 'Fallback Channel', priority: 5 });
    const fetchMock = mockFetchSequence([
      {
        status: 400,
        headers: { 'content-type': 'application/json' },
        body: { error: { message: 'bad request' } },
      },
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: {
          id: 'chatcmpl_should_not_happen',
          object: 'chat.completion',
          choices: [],
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
          'x-request-id': 'relay-non-retryable-request',
        },
        payload: {
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'hello' }],
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.headers['x-relay-attempts']).toBeUndefined();
      expect(response.headers['x-relay-chain']).toBeUndefined();
      expect(response.json().error.message).toBe('bad request');
      expect(fetchMock).toHaveBeenCalledTimes(1);

      const log = await prisma.usageLog.findUnique({
        where: { requestId: 'relay-non-retryable-request' },
      });

      expect(log?.success).toBe(false);
      expect(log?.statusCode).toBe(400);
      expect(log?.errorMessage).toBe('Primary Channel:400');
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
