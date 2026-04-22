import { decryptChannelKey } from '../../lib/crypto.js';
import type { ClaudeMessagesBody, RelayChannel, RelayResult } from './types.js';

const DEFAULT_ANTHROPIC_VERSION = '2023-06-01';

const getAnthropicMessagesUrl = (channel: RelayChannel) => {
  const normalizedBase = (channel.baseUrl ?? 'https://api.anthropic.com/v1').replace(/\/+$/, '');

  return normalizedBase.endsWith('/messages') ? normalizedBase : `${normalizedBase}/messages`;
};

const buildAnthropicHeaders = (channel: RelayChannel, anthropicVersion?: string) => ({
  'content-type': 'application/json',
  'x-api-key': decryptChannelKey(channel.encryptedKey),
  'anthropic-version': anthropicVersion?.trim() || DEFAULT_ANTHROPIC_VERSION,
});

const buildClaudeBody = (body: ClaudeMessagesBody, channel: RelayChannel) => ({
  ...body,
  model: channel.model ?? body.model,
});

const extractClaudeUsage = (responseBody: unknown) => {
  const usage =
    typeof responseBody === 'object' && responseBody && 'usage' in responseBody
      ? (responseBody.usage as {
          input_tokens?: number;
          output_tokens?: number;
        })
      : null;

  const promptTokens = typeof usage?.input_tokens === 'number' ? usage.input_tokens : 0;
  const completionTokens = typeof usage?.output_tokens === 'number' ? usage.output_tokens : 0;

  return {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
  };
};

const extractStreamErrorMessage = (responseBody: string) => {
  const lines = responseBody.split('\n');

  for (let index = 0; index < lines.length; index += 1) {
    if (!/^event:\s*error$/i.test(lines[index] ?? '')) {
      continue;
    }

    const dataLine = lines.slice(index + 1).find((line) => line.startsWith('data:'));

    if (!dataLine) {
      break;
    }

    const rawData = dataLine.slice(5).trim();

    if (!rawData) {
      break;
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
      return rawData;
    }
  }

  return 'Upstream event stream returned an error';
};

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

export const sendClaudeMessages = async (
  channel: RelayChannel,
  body: ClaudeMessagesBody,
  anthropicVersion?: string,
): Promise<RelayResult> => {
  const response = await fetch(getAnthropicMessagesUrl(channel), {
    method: 'POST',
    headers: buildAnthropicHeaders(channel, anthropicVersion),
    body: JSON.stringify(buildClaudeBody(body, channel)),
  });

  const responseBody = await readResponseBody(response);

  if (typeof responseBody === 'string') {
    return normalizeStreamResult(response.status, responseBody);
  }

  const usage = extractClaudeUsage(responseBody);

  return {
    statusCode: response.status,
    body: responseBody,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    totalTokens: usage.totalTokens,
  };
};
