import { decryptChannelKey } from '../../lib/crypto.js';
import type { GeminiGenerateContentBody, RelayChannel, RelayResult } from './types.js';

const DEFAULT_GEMINI_VERSION = 'v1beta';
const STREAM_ACTION = 'streamGenerateContent';
const GENERATE_ACTION = 'generateContent';

const normalizeGeminiModel = (path: string) => {
  const withoutQuery = path.split('?')[0] ?? path;
  const match = withoutQuery.match(/^\/models\/([^:]+):([^/?]+)$/);

  if (!match) {
    throw new Error('Invalid Gemini relay path');
  }

  return {
    model: match[1]!,
    action: match[2]!,
  };
};

const getGeminiUrl = (channel: RelayChannel, path: string) => {
  const normalizedBase = (channel.baseUrl ?? 'https://generativelanguage.googleapis.com').replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  if (/\/v1(beta)?$/i.test(normalizedBase)) {
    return `${normalizedBase}${normalizedPath}`;
  }

  return `${normalizedBase}/${DEFAULT_GEMINI_VERSION}${normalizedPath}`;
};

const getGeminiRequestModel = (channel: RelayChannel, requestedModel: string) => {
  const configuredModel = channel.model?.trim();

  return configuredModel && !configuredModel.startsWith('models/')
    ? configuredModel
    : configuredModel?.replace(/^models\//, '') || requestedModel;
};

const buildGeminiRequestPath = (channel: RelayChannel, requestedModel: string, action: string) =>
  `/models/${getGeminiRequestModel(channel, requestedModel)}:${action}`;

const buildGeminiBody = (body: GeminiGenerateContentBody): GeminiGenerateContentBody => ({
  ...body,
});

const buildGeminiErrorBody = (message: string) => ({ error: { message } });

const isGeminiErrorBody = (responseBody: unknown): responseBody is { error: { message?: string } | string } =>
  Boolean(responseBody && typeof responseBody === 'object' && 'error' in responseBody);

const isGeminiResponseBody = (responseBody: unknown): responseBody is { candidates?: unknown[]; usageMetadata?: unknown } =>
  Boolean(responseBody && typeof responseBody === 'object' && ('candidates' in responseBody || 'usageMetadata' in responseBody));

const normalizeGeminiJsonResult = (statusCode: number, responseBody: unknown) => {
  if (statusCode >= 200 && statusCode < 300 && !isGeminiResponseBody(responseBody)) {
    return {
      statusCode: 502,
      body: buildGeminiErrorBody(extractGeminiErrorMessage(responseBody)),
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    } satisfies RelayResult;
  }

  if (statusCode >= 200 && statusCode < 300 && isGeminiErrorBody(responseBody)) {
    return {
      statusCode: 502,
      body: buildGeminiErrorBody(extractGeminiErrorMessage(responseBody)),
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    } satisfies RelayResult;
  }

  return null;
};

const extractGeminiErrorMessage = (responseBody: unknown) => {
  if (typeof responseBody === 'string' && responseBody.trim()) {
    return responseBody;
  }

  if (responseBody && typeof responseBody === 'object' && 'error' in responseBody) {
    const error = responseBody.error;

    if (typeof error === 'string' && error.trim()) {
      return error;
    }

    if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' && error.message.trim()) {
      return error.message;
    }
  }

  return 'Upstream request failed';
};

const buildGeminiHeaders = (channel: RelayChannel) => ({
  'content-type': 'application/json',
  'x-goog-api-key': decryptChannelKey(channel.encryptedKey),
});

const extractGeminiUsage = (responseBody: unknown) => {
  const usage =
    typeof responseBody === 'object' && responseBody && 'usageMetadata' in responseBody
      ? (responseBody.usageMetadata as {
          promptTokenCount?: number;
          toolUsePromptTokenCount?: number;
          candidatesTokenCount?: number;
          thoughtsTokenCount?: number;
          totalTokenCount?: number;
        })
      : null;

  const promptTokens = (typeof usage?.promptTokenCount === 'number' ? usage.promptTokenCount : 0)
    + (typeof usage?.toolUsePromptTokenCount === 'number' ? usage.toolUsePromptTokenCount : 0);
  const completionTokens = (typeof usage?.candidatesTokenCount === 'number' ? usage.candidatesTokenCount : 0)
    + (typeof usage?.thoughtsTokenCount === 'number' ? usage.thoughtsTokenCount : 0);
  const totalTokens = typeof usage?.totalTokenCount === 'number'
    ? usage.totalTokenCount
    : promptTokens + completionTokens;

  return {
    promptTokens,
    completionTokens,
    totalTokens,
  };
};

const extractStreamErrorMessage = (responseBody: string) => {
  const dataLine = responseBody.split('\n').find((line) => line.startsWith('data:'));

  if (!dataLine) {
    return 'Upstream event stream returned an error';
  }

  const rawData = dataLine.slice(5).trim();

  if (!rawData) {
    return 'Upstream event stream returned an error';
  }

  try {
    const parsed = JSON.parse(rawData);

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
    return rawData;
  }

  return 'Upstream event stream returned an error';
};

const normalizeStreamResult = (statusCode: number, responseBody: string) => {
  if (statusCode >= 200 && statusCode < 300 && /"error"\s*:/m.test(responseBody)) {
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

export const sendGeminiGenerateContent = async (
  channel: RelayChannel,
  path: string,
  body: GeminiGenerateContentBody,
): Promise<RelayResult> => {
  const { model, action } = normalizeGeminiModel(path);
  const resolvedAction = action === STREAM_ACTION ? `${STREAM_ACTION}?alt=sse` : GENERATE_ACTION;
  const response = await fetch(getGeminiUrl(channel, buildGeminiRequestPath(channel, model, resolvedAction)), {
    method: 'POST',
    headers: buildGeminiHeaders(channel),
    body: JSON.stringify(buildGeminiBody(body)),
  });

  const responseBody = await readResponseBody(response);

  if (typeof responseBody === 'string') {
    return normalizeStreamResult(response.status, responseBody);
  }

  const normalizedJsonResult = normalizeGeminiJsonResult(response.status, responseBody);

  if (normalizedJsonResult) {
    return normalizedJsonResult;
  }

  const usage = extractGeminiUsage(responseBody);

  return {
    statusCode: response.status,
    body: responseBody,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    totalTokens: usage.totalTokens,
  };
};
