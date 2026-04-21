import { prisma } from '../../src/lib/prisma.js';
import { closeTestApp, createTestApp } from '../helpers/app.js';
import { createApiKey, createChannel, createUser } from '../helpers/factories.js';
import { mockFetchOnce } from '../helpers/fetch.js';

describe('relay embeddings integration', () => {
  it('proxies an authenticated embeddings request and writes a usage log', async () => {
    const user = await createUser();
    const { apiKey } = await createApiKey(user.id);
    await createChannel({ model: 'text-embedding-3-small' });
    mockFetchOnce({
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: {
        object: 'list',
        data: [
          {
            object: 'embedding',
            index: 0,
            embedding: [0.1, 0.2, 0.3],
          },
        ],
        model: 'text-embedding-3-small',
        usage: {
          prompt_tokens: 8,
          total_tokens: 8,
        },
      },
    });

    const app = await createTestApp();

    try {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/embeddings',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'x-request-id': 'relay-embeddings-request',
        },
        payload: {
          model: 'text-embedding-3-small',
          input: 'hello embeddings',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data[0].embedding).toEqual([0.1, 0.2, 0.3]);

      const log = await prisma.usageLog.findUnique({
        where: { requestId: 'relay-embeddings-request' },
      });

      expect(log?.success).toBe(true);
      expect(log?.endpoint).toBe('/v1/embeddings');
      expect(log?.promptTokens).toBe(8);
      expect(log?.totalTokens).toBe(8);
    } finally {
      await closeTestApp(app);
    }
  });
});
