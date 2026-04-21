import { prisma } from '../../src/lib/prisma.js';
import { closeTestApp, createTestApp } from '../helpers/app.js';
import { createApiKey, createChannel, createUser } from '../helpers/factories.js';
import { mockFetchOnce } from '../helpers/fetch.js';

describe('relay responses integration', () => {
  it('proxies an authenticated responses request and writes a usage log', async () => {
    const user = await createUser();
    const { apiKey } = await createApiKey(user.id);
    await createChannel({ model: 'gpt-4.1-mini' });
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
});
