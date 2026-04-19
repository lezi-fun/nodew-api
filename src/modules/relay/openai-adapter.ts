import { decryptChannelKey } from '../../lib/crypto.js';
import type { ChatCompletionsBody, RelayChannel, RelayResult } from './types.js';

const getOpenAIBaseUrl = (channel: RelayChannel) => {
  const normalizedBase = (channel.baseUrl ?? 'https://api.openai.com/v1').replace(/\/+$/, '');

  return normalizedBase.endsWith('/chat/completions') ? normalizedBase : `${normalizedBase}/chat/completions`;
};

const extractUsage = (responseBody: unknown) => {
  const usage =
    typeof responseBody === 'object' && responseBody && 'usage' in responseBody
      ? (responseBody.usage as {
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
        })
      : null;

  return {
    promptTokens: typeof usage?.prompt_tokens === 'number' ? usage.prompt_tokens : 0,
    completionTokens: typeof usage?.completion_tokens === 'number' ? usage.completion_tokens : 0,
    totalTokens: typeof usage?.total_tokens === 'number' ? usage.total_tokens : 0,
  };
};

const readResponseBody = async (response: Response) => {
  if (response.body && response.headers.get('content-type')?.includes('text/event-stream')) {
    return await response.text();
  }

  return response.json().catch(async () => ({ error: { message: await response.text() } }));
};

export const sendOpenAIChatCompletion = async (
  channel: RelayChannel,
  body: ChatCompletionsBody,
): Promise<RelayResult> => {
  const response = await fetch(getOpenAIBaseUrl(channel), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${decryptChannelKey(channel.encryptedKey)}`,
    },
    body: JSON.stringify({
      ...body,
      model: channel.model ?? body.model,
    }),
  });

  const responseBody = await readResponseBody(response);
  const usage = typeof responseBody === 'string' ? {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  } : extractUsage(responseBody);

  return {
    statusCode: response.status,
    body: responseBody,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    totalTokens: usage.totalTokens,
  };
};
