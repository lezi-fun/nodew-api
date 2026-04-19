import { prisma } from '../../src/lib/prisma.js';
import { closeTestApp, createTestApp } from '../helpers/app.js';
import { createApiKey, createChannel, createUser } from '../helpers/factories.js';
import { mockFetchOnce } from '../helpers/fetch.js';

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
});
