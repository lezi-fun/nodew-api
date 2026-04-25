import { closeTestApp, createTestApp } from '../helpers/app.js';
import { createApiKey, createChannel, createUser } from '../helpers/factories.js';
import { mockFetchSequence } from '../helpers/fetch.js';

describe('relay weighted channel selection', () => {
  it('rotates same-model channels according to weight', async () => {
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
      expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
        'https://a.example.test/v1/chat/completions',
        'https://a.example.test/v1/chat/completions',
        'https://a.example.test/v1/chat/completions',
        'https://b.example.test/v1/chat/completions',
        'https://b.example.test/v1/chat/completions',
        'https://c.example.test/v1/chat/completions',
      ]);
    } finally {
      await closeTestApp(app);
    }
  });
});
