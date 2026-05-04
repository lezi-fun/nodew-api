import { orderRelayChannels, weightedRandomPermutation } from '../../src/modules/relay/balancer.js';
import type { RelayChannel } from '../../src/modules/relay/types.js';
import { closeTestApp, createTestApp } from '../helpers/app.js';
import { createApiKey, createChannel, createUser } from '../helpers/factories.js';
import { mockFetchSequence } from '../helpers/fetch.js';

describe('relay weighted channel selection', () => {
  const channel = (overrides: Partial<RelayChannel>): RelayChannel => ({
    id: overrides.id ?? overrides.name ?? 'channel',
    name: overrides.name ?? overrides.id ?? 'channel',
    provider: overrides.provider ?? 'openai',
    baseUrl: overrides.baseUrl ?? 'https://example.test/v1',
    model: overrides.model ?? 'gpt-weighted',
    encryptedKey: overrides.encryptedKey ?? 'encrypted',
    priority: overrides.priority ?? 0,
    weight: overrides.weight ?? 1,
    rateLimitPerMin: overrides.rateLimitPerMin ?? null,
    metadata: overrides.metadata ?? null,
  });

  it('orders one priority group with weighted random choices', () => {
    const ordered = weightedRandomPermutation([
      channel({ id: 'a', name: 'Channel A', weight: 3 }),
      channel({ id: 'b', name: 'Channel B', weight: 2 }),
      channel({ id: 'c', name: 'Channel C', weight: 1 }),
    ], vi.fn()
      .mockReturnValueOnce(0.4)
      .mockReturnValueOnce(0.8)
      .mockReturnValueOnce(0));

    expect(ordered.map((item) => item.id)).toEqual(['a', 'c', 'b']);
  });

  it('keeps higher priority groups ahead of lower priority groups', () => {
    const ordered = orderRelayChannels([
      channel({ id: 'low-heavy', priority: 0, weight: 100 }),
      channel({ id: 'high-light', priority: 10, weight: 1 }),
    ], vi.fn().mockReturnValue(0.99));

    expect(ordered.map((item) => item.id)).toEqual(['high-light', 'low-heavy']);
  });

  it('selects same-model channels through the relay path', async () => {
    const user = await createUser();
    const { apiKey } = await createApiKey(user.id);
    await createChannel({ name: 'Channel A', baseUrl: 'https://a.example.test/v1', model: 'gpt-weighted', weight: 3 });
    await createChannel({ name: 'Channel B', baseUrl: 'https://b.example.test/v1', model: 'gpt-weighted', weight: 2 });
    await createChannel({ name: 'Channel C', baseUrl: 'https://c.example.test/v1', model: 'gpt-weighted', weight: 1 });
    const fetchMock = mockFetchSequence(Array.from({ length: 6 }, (_, index) => ({
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: {
        id: `chat_${index}`,
        object: 'chat.completion',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: `ok ${index}` },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 1,
          completion_tokens: 1,
          total_tokens: 2,
        },
      },
    })));
    const app = await createTestApp();

    try {
      for (let index = 0; index < 6; index += 1) {
        const response = await app.inject({
          method: 'POST',
          url: '/v1/chat/completions',
          headers: {
            authorization: `Bearer ${apiKey}`,
            'x-request-id': `weighted-request-${index}`,
          },
          payload: {
            model: 'gpt-weighted',
            messages: [{ role: 'user', content: 'hello' }],
          },
        });

        expect(response.statusCode).toBe(200);
      }

      expect(fetchMock).toHaveBeenCalledTimes(6);
      expect(fetchMock.mock.calls.every((call) =>
        typeof call[0] === 'string' &&
        /^https:\/\/[abc]\.example\.test\/v1\/chat\/completions$/.test(call[0]),
      )).toBe(true);
    } finally {
      await closeTestApp(app);
    }
  });
});
