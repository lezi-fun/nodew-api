import { prisma } from '../../src/lib/prisma.js';
import { closeTestApp, createTestApp } from '../helpers/app.js';
import { createApiKey, createChannel, createUser } from '../helpers/factories.js';
import { mockFetchOnce, mockFetchSequence } from '../helpers/fetch.js';

describe('relay embeddings integration', () => {
  it('proxies an authenticated embeddings request and writes a usage log', async () => {
    const user = await createUser();
    const { apiKey } = await createApiKey(user.id);
    await createChannel({ name: 'Embeddings Channel', model: 'text-embedding-3-small' });
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

  it('falls back to the next active channel after a retryable embeddings failure', async () => {
    const user = await createUser();
    const { apiKey } = await createApiKey(user.id);
    await createChannel({ name: 'Primary Embeddings Channel', model: 'text-embedding-3-small', priority: 10 });
    await createChannel({ name: 'Fallback Embeddings Channel', model: 'text-embedding-3-small', priority: 5 });
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
          object: 'list',
          data: [
            {
              object: 'embedding',
              index: 0,
              embedding: [0.4, 0.5, 0.6],
            },
          ],
          model: 'text-embedding-3-small',
          usage: {
            prompt_tokens: 6,
            total_tokens: 6,
          },
        },
      },
    ]);

    const app = await createTestApp();

    try {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/embeddings',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'x-request-id': 'relay-embeddings-fallback-request',
        },
        payload: {
          model: 'text-embedding-3-small',
          input: 'retry me',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['x-relay-attempts']).toBe('2');
      expect(response.headers['x-relay-chain']).toBe('Primary Embeddings Channel,Fallback Embeddings Channel');
      expect(response.json().data[0].embedding).toEqual([0.4, 0.5, 0.6]);

      const log = await prisma.usageLog.findUnique({
        where: { requestId: 'relay-embeddings-fallback-request' },
      });

      expect(log?.success).toBe(true);
      expect(log?.errorMessage).toContain('fallback chain: Primary Embeddings Channel:500 -> Fallback Embeddings Channel:200');
    } finally {
      await closeTestApp(app);
    }
  });

  it('does not fall back when an embeddings error is non-retryable', async () => {
    const user = await createUser();
    const { apiKey } = await createApiKey(user.id);
    await createChannel({ name: 'Primary Embeddings Channel', model: 'text-embedding-3-small', priority: 10 });
    await createChannel({ name: 'Fallback Embeddings Channel', model: 'text-embedding-3-small', priority: 5 });
    const fetchMock = mockFetchSequence([
      {
        status: 400,
        headers: { 'content-type': 'application/json' },
        body: { error: { message: 'bad embedding request' } },
      },
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: {
          object: 'list',
          data: [],
          model: 'text-embedding-3-small',
        },
      },
    ]);

    const app = await createTestApp();

    try {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/embeddings',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'x-request-id': 'relay-embeddings-non-retryable-request',
        },
        payload: {
          model: 'text-embedding-3-small',
          input: 'bad input',
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.headers['x-relay-attempts']).toBeUndefined();
      expect(response.headers['x-relay-chain']).toBeUndefined();
      expect(response.json().error.message).toBe('bad embedding request');
      expect(fetchMock).toHaveBeenCalledTimes(1);

      const log = await prisma.usageLog.findUnique({
        where: { requestId: 'relay-embeddings-non-retryable-request' },
      });

      expect(log?.success).toBe(false);
      expect(log?.statusCode).toBe(400);
      expect(log?.errorMessage).toBe('Primary Embeddings Channel:400');
    } finally {
      await closeTestApp(app);
    }
  });
});
