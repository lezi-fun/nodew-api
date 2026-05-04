import { Readable } from 'node:stream';
import { TextDecoder } from 'node:util';

import { decryptChannelKey } from '../../lib/crypto.js';
import { resolveUpstreamModel } from './model-routing.js';
import { writeMultipartField } from './multipart.js';
import { getOpenAICompatibleBaseUrl, getProviderExtraHeaders } from './providers.js';
import type { ChatCompletionsBody, EmbeddingsBody, ModelRoutedBody, RelayChannel, RelayResult, ResponsesBody } from './types.js';

const getOpenAIEndpointUrl = (channel: RelayChannel, path: string) => {
  const normalizedBase = getOpenAICompatibleBaseUrl(channel).replace(/\/+$/, '');

  return normalizedBase.endsWith(path) ? normalizedBase : `${normalizedBase}/${path}`;
};

const getOpenAIBaseUrl = (channel: RelayChannel) => getOpenAIEndpointUrl(channel, 'chat/completions');
const getOpenAIEmbeddingsUrl = (channel: RelayChannel) => getOpenAIEndpointUrl(channel, 'embeddings');
const getOpenAIResponsesUrl = (channel: RelayChannel) => getOpenAIEndpointUrl(channel, 'responses');

const buildOpenAIHeaders = (channel: RelayChannel) => ({
  ...getProviderExtraHeaders(channel),
  'content-type': 'application/json',
  authorization: `Bearer ${decryptChannelKey(channel.encryptedKey)}`,
});

const buildOpenAIRawHeaders = (channel: RelayChannel, contentType: string) => ({
  ...getProviderExtraHeaders(channel),
  'content-type': contentType,
  authorization: `Bearer ${decryptChannelKey(channel.encryptedKey)}`,
});

const buildModelBody = <T extends { model: string }>(body: T, channel: RelayChannel) => ({
  ...body,
  model: resolveUpstreamModel(channel, body.model),
});

const buildOptionalModelBody = (body: ModelRoutedBody, channel: RelayChannel) => ({
  ...body,
  ...(body.model ? { model: resolveUpstreamModel(channel, body.model) } : {}),
});

const normalizeStreamResult = (statusCode: number, responseBody: string) => {
  if (statusCode >= 200 && statusCode < 300 && /^event:\s*error/m.test(responseBody)) {
    return {
      statusCode: 502,
      body: { error: { message: extractStreamErrorMessage(responseBody) } },
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    } satisfies RelayResult;
  }

  return {
    statusCode,
    body: responseBody,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  } satisfies RelayResult;
};

const readRemainingStreamText = async (
  reader: ReadableStreamDefaultReader<Uint8Array>,
  decoder: TextDecoder,
  initialText: string,
) => {
  let responseBody = initialText;

  while (true) {
    const next = await reader.read();

    if (next.done) {
      break;
    }

    responseBody += decoder.decode(next.value, { stream: true });
  }

  responseBody += decoder.decode();

  return responseBody;
};

const streamFromFirstChunk = (
  reader: ReadableStreamDefaultReader<Uint8Array>,
  firstChunk: Uint8Array,
) => Readable.from((async function* streamChunks() {
  yield Buffer.from(firstChunk);

  while (true) {
    const next = await reader.read();

    if (next.done) {
      break;
    }

    yield Buffer.from(next.value);
  }
})());

const normalizeSuccessfulEventStream = async (statusCode: number, body: ReadableStream<Uint8Array>): Promise<RelayResult> => {
  const reader = body.getReader();
  const first = await reader.read();

  if (first.done) {
    return normalizeStreamResult(statusCode, '');
  }

  const decoder = new TextDecoder();
  const firstText = decoder.decode(first.value, { stream: true });

  if (/^event:\s*error$/m.test(firstText)) {
    const responseBody = await readRemainingStreamText(reader, decoder, firstText);

    return normalizeStreamResult(statusCode, responseBody);
  }

  return {
    statusCode,
    body: streamFromFirstChunk(reader, first.value),
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  };
};

const sendOpenAIRequest = async (channel: RelayChannel, url: string, body: object): Promise<RelayResult> => {
  const response = await fetch(url, {
    method: 'POST',
    headers: buildOpenAIHeaders(channel),
    body: JSON.stringify(body),
  });

  return normalizeOpenAIResponse(response);
};

const normalizeOpenAIResponse = async (response: Response): Promise<RelayResult> => {
  const contentType = response.headers.get('content-type') ?? undefined;
  const isEventStream = contentType?.includes('text/event-stream') ?? false;
  const isJson = contentType?.includes('application/json') ?? false;

  if (response.ok && isEventStream && response.body) {
    return normalizeSuccessfulEventStream(response.status, response.body);
  }

  if (response.ok && response.body && !isJson) {
    return {
      statusCode: response.status,
      body: Readable.fromWeb(response.body),
      contentType,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    };
  }

  const responseBody = await readResponseBody(response);

  if (typeof responseBody === 'string') {
    return normalizeStreamResult(response.status, responseBody);
  }

  const usage = extractUsage(responseBody);

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
          input_tokens?: number;
          output_tokens?: number;
        })
      : null;

  const promptTokens = typeof usage?.prompt_tokens === 'number'
    ? usage.prompt_tokens
    : typeof usage?.input_tokens === 'number'
      ? usage.input_tokens
      : 0;

  const completionTokens = typeof usage?.completion_tokens === 'number'
    ? usage.completion_tokens
    : typeof usage?.output_tokens === 'number'
      ? usage.output_tokens
      : 0;

  const totalTokens = typeof usage?.total_tokens === 'number'
    ? usage.total_tokens
    : promptTokens + completionTokens;

  return {
    promptTokens,
    completionTokens,
    totalTokens,
  };
};

const extractStreamErrorMessage = (responseBody: string) => {
  const dataLine = responseBody
    .split('\n')
    .find((line) => line.startsWith('data:'));

  if (!dataLine) {
    return 'Upstream event stream returned an error';
  }

  const rawData = dataLine.slice(5).trim();

  if (!rawData) {
    return 'Upstream event stream returned an error';
  }

  try {
    const parsed = JSON.parse(rawData);

    if (typeof parsed === 'string' && parsed.trim()) {
      return parsed;
    }

    if (parsed && typeof parsed === 'object' && 'error' in parsed) {
      const error = parsed.error;

      if (typeof error === 'string' && error.trim()) {
        return error;
      }

      if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' && error.message.trim()) {
        return error.message;
      }
    }
  } catch {
    if (rawData !== '"{"') {
      return rawData;
    }
  }

  return 'Upstream event stream returned an error';
};

const readResponseBody = async (response: Response) => {
  const rawBody = await response.text();

  if (response.headers.get('content-type')?.includes('text/event-stream')) {
    return rawBody;
  }

  if (!rawBody) {
    return { error: { message: 'Upstream request failed' } };
  }

  try {
    return JSON.parse(rawBody);
  } catch {
    return { error: { message: rawBody } };
  }
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

export const sendOpenAIJsonEndpoint = async (
  channel: RelayChannel,
  path: string,
  body: ModelRoutedBody,
): Promise<RelayResult> => sendOpenAIRequest(channel, getOpenAIEndpointUrl(channel, path), buildOptionalModelBody(body, channel));

export const sendOpenAIMultipartEndpoint = async (
  channel: RelayChannel,
  path: string,
  body: Buffer,
  contentType: string,
  requestedModel: string,
): Promise<RelayResult> => {
  const upstreamModel = resolveUpstreamModel(channel, requestedModel);
  const response = await fetch(getOpenAIEndpointUrl(channel, path), {
    method: 'POST',
    headers: buildOpenAIRawHeaders(channel, contentType),
    body: writeMultipartField(body, contentType, 'model', upstreamModel),
  });

  return normalizeOpenAIResponse(response);
};
