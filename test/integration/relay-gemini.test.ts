import { prisma } from '../../src/lib/prisma.js';
import { closeTestApp, createTestApp } from '../helpers/app.js';
import { createApiKey, createChannel, createUser } from '../helpers/factories.js';
import { mockFetchOnce, mockFetchSequence } from '../helpers/fetch.js';

describe('relay gemini integration', () => {
  it('accepts Gemini auth headers, proxies generateContent, and writes a usage log', async () => {
    const user = await createUser();
    const { apiKey } = await createApiKey(user.id);
    await createChannel({
      name: 'Gemini Channel',
      provider: 'gemini',
      baseUrl: 'https://generativelanguage.googleapis.com',
      model: 'gemini-2.0-flash',
    });
    const fetchMock = mockFetchOnce({
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: {
        candidates: [
          {
            content: {
              parts: [{ text: 'gemini ok' }],
              role: 'model',
            },
            finishReason: 'STOP',
            index: 0,
          },
        ],
        usageMetadata: {
          promptTokenCount: 9,
          toolUsePromptTokenCount: 1,
          candidatesTokenCount: 4,
          thoughtsTokenCount: 2,
          totalTokenCount: 16,
        },
      },
    });

    const app = await createTestApp();

    try {
      const response = await app.inject({
        method: 'POST',
        url: '/v1beta/models/gemini-2.0-flash:generateContent',
        headers: {
          'x-goog-api-key': apiKey,
          'x-request-id': 'relay-gemini-request',
        },
        payload: {
          contents: [
            {
              role: 'user',
              parts: [{ text: 'hello gemini' }],
            },
          ],
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().candidates[0].content.parts[0].text).toBe('gemini ok');
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0]?.[0]).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent');
      expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
        method: 'POST',
        headers: expect.objectContaining({
          'x-goog-api-key': 'channel-secret-key',
          'content-type': 'application/json',
        }),
      });

      const log = await prisma.usageLog.findUnique({
        where: { requestId: 'relay-gemini-request' },
      });

      expect(log?.success).toBe(true);
      expect(log?.endpoint).toBe('/v1beta/models/gemini-2.0-flash:generateContent');
      expect(log?.promptTokens).toBe(10);
      expect(log?.completionTokens).toBe(6);
      expect(log?.totalTokens).toBe(16);
    } finally {
      await closeTestApp(app);
    }
  });

  it('converts Gemini generateContent requests through OpenAI channels when no Gemini channel exists', async () => {
    const user = await createUser();
    const { apiKey } = await createApiKey(user.id);
    await createChannel({
      name: 'OpenAI Gemini Bridge Channel',
      provider: 'openai',
      baseUrl: 'https://example.test/v1',
      model: 'gemini-2.0-flash',
    });
    const fetchMock = mockFetchOnce({
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: {
        id: 'chat_bridge',
        object: 'chat.completion',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'openai bridge ok',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 8,
          completion_tokens: 5,
          total_tokens: 13,
        },
      },
    });

    const app = await createTestApp();

    try {
      const response = await app.inject({
        method: 'POST',
        url: '/v1beta/models/gemini-2.0-flash:generateContent',
        headers: {
          'x-goog-api-key': apiKey,
          'x-request-id': 'relay-gemini-openai-bridge-request',
        },
        payload: {
          systemInstruction: {
            parts: [{ text: 'be concise' }],
          },
          contents: [
            {
              role: 'user',
              parts: [{ text: 'hello bridge' }],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            topP: 0.9,
            maxOutputTokens: 32,
            stopSequences: ['stop'],
          },
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().candidates[0].content.parts[0].text).toBe('openai bridge ok');
      expect(response.json().usageMetadata.totalTokenCount).toBe(13);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0]?.[0]).toBe('https://example.test/v1/chat/completions');
      expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)).toMatchObject({
        model: 'gemini-2.0-flash',
        messages: [
          { role: 'system', content: 'be concise' },
          { role: 'user', content: 'hello bridge' },
        ],
        temperature: 0.2,
        top_p: 0.9,
        max_tokens: 32,
        stop: ['stop'],
      });

      const log = await prisma.usageLog.findUnique({
        where: { requestId: 'relay-gemini-openai-bridge-request' },
      });

      expect(log?.success).toBe(true);
      expect(log?.provider).toBe('openai');
      expect(log?.totalTokens).toBe(13);
    } finally {
      await closeTestApp(app);
    }
  });

  it('accepts Gemini query-string auth and falls back across gemini channels only', async () => {
    const user = await createUser();
    const { apiKey } = await createApiKey(user.id);
    await createChannel({
      name: 'Primary Gemini Channel',
      provider: 'gemini',
      baseUrl: 'https://generativelanguage.googleapis.com',
      model: 'gemini-2.0-flash',
      priority: 10,
    });
    await createChannel({
      name: 'Fallback Gemini Channel',
      provider: 'gemini',
      baseUrl: 'https://generativelanguage.googleapis.com',
      model: 'gemini-2.0-flash',
      priority: 5,
    });
    await createChannel({
      name: 'OpenAI Channel',
      provider: 'openai',
      model: 'gemini-2.0-flash',
      priority: 100,
    });
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
          candidates: [
            {
              content: {
                parts: [{ text: 'fallback ok' }],
                role: 'model',
              },
              finishReason: 'STOP',
              index: 0,
            },
          ],
          usageMetadata: {
            promptTokenCount: 5,
            candidatesTokenCount: 3,
            totalTokenCount: 8,
          },
        },
      },
    ]);

    const app = await createTestApp();

    try {
      const response = await app.inject({
        method: 'POST',
        url: `/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        headers: {
          'x-request-id': 'relay-gemini-fallback-request',
        },
        payload: {
          contents: [
            {
              role: 'user',
              parts: [{ text: 'retry me' }],
            },
          ],
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['x-relay-attempts']).toBe('2');
      expect(response.headers['x-relay-chain']).toBe('Primary Gemini Channel,Fallback Gemini Channel');
      expect(response.json().candidates[0].content.parts[0].text).toBe('fallback ok');

      const log = await prisma.usageLog.findUnique({
        where: { requestId: 'relay-gemini-fallback-request' },
      });

      expect(log?.success).toBe(true);
      expect(log?.errorMessage).toContain('fallback chain: Primary Gemini Channel:500 -> Fallback Gemini Channel:200');
    } finally {
      await closeTestApp(app);
    }
  });

  it('forwards Gemini stream responses and records zero-token usage', async () => {
    const user = await createUser();
    const { apiKey } = await createApiKey(user.id);
    await createChannel({
      name: 'Gemini Stream Channel',
      provider: 'gemini',
      baseUrl: 'https://generativelanguage.googleapis.com',
      model: 'gemini-2.0-flash',
    });
    mockFetchOnce({
      status: 200,
      headers: { 'content-type': 'text/event-stream; charset=utf-8' },
      body: 'data: {"candidates":[{"content":{"parts":[{"text":"hello"}]}}]}\n\ndata: [DONE]\n\n',
    });

    const app = await createTestApp();

    try {
      const response = await app.inject({
        method: 'POST',
        url: '/v1beta/models/gemini-2.0-flash:streamGenerateContent',
        headers: {
          'x-goog-api-key': apiKey,
          'x-request-id': 'relay-gemini-stream-request',
        },
        payload: {
          contents: [
            {
              role: 'user',
              parts: [{ text: 'hello stream' }],
            },
          ],
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/event-stream');
      expect(response.body).toContain('hello');
      expect(response.body).toContain('[DONE]');

      const log = await prisma.usageLog.findUnique({
        where: { requestId: 'relay-gemini-stream-request' },
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
