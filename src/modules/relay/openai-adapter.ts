import { decryptChannelKey } from '../../lib/crypto.js';
import type { ChatCompletionsBody, EmbeddingsBody, RelayChannel, RelayResult, ResponsesBody } from './types.js';

const getOpenAIEndpointUrl = (channel: RelayChannel, path: string) => {
  const normalizedBase = (channel.baseUrl ?? 'https://api.openai.com/v1').replace(/\/+$/, '');

  return normalizedBase.endsWith(path) ? normalizedBase : `${normalizedBase}/${path}`;
};

const getOpenAIBaseUrl = (channel: RelayChannel) => getOpenAIEndpointUrl(channel, 'chat/completions');
const getOpenAIEmbeddingsUrl = (channel: RelayChannel) => getOpenAIEndpointUrl(channel, 'embeddings');
const getOpenAIResponsesUrl = (channel: RelayChannel) => getOpenAIEndpointUrl(channel, 'responses');

const buildOpenAIHeaders = (channel: RelayChannel) => ({
  'content-type': 'application/json',
  authorization: `Bearer ${decryptChannelKey(channel.encryptedKey)}`,
});

const buildModelBody = <T extends { model: string }>(body: T, channel: RelayChannel) => ({
  ...body,
  model: channel.model ?? body.model,
});

const sendOpenAIRequest = async (channel: RelayChannel, url: string, body: object): Promise<RelayResult> => {
  const response = await fetch(url, {
    method: 'POST',
    headers: buildOpenAIHeaders(channel),
    body: JSON.stringify(body),
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
): Promise<RelayResult> => sendOpenAIRequest(channel, getOpenAIBaseUrl(channel), buildModelBody(body, channel));

export const sendOpenAIEmbeddings = async (
  channel: RelayChannel,
  body: EmbeddingsBody,
): Promise<RelayResult> => sendOpenAIRequest(channel, getOpenAIEmbeddingsUrl(channel), buildModelBody(body, channel));

export const sendOpenAIResponses = async (
  channel: RelayChannel,
  body: ResponsesBody,
): Promise<RelayResult> => sendOpenAIRequest(channel, getOpenAIResponsesUrl(channel), buildModelBody(body, channel));
