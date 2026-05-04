import { executeRelay } from './executor.js';
import { sendOpenAIJsonEndpoint, sendOpenAIMultipartEndpoint } from './openai-adapter.js';
import { getOpenAICompatibleProviders } from './providers.js';
import type { ModelRoutedBody, RelayExecutionResult } from './types.js';

export const relayOpenAIJsonEndpoint = async (params: {
  userId: string;
  apiKeyId: string;
  requestId: string;
  endpoint: string;
  upstreamPath: string;
  model: string;
  body: ModelRoutedBody;
}): Promise<RelayExecutionResult> => executeRelay({
  userId: params.userId,
  apiKeyId: params.apiKeyId,
  requestId: params.requestId,
  model: params.model,
  endpoint: params.endpoint,
  providers: getOpenAICompatibleProviders(),
  send: (channel) => sendOpenAIJsonEndpoint(channel, params.upstreamPath, params.body),
});

export const relayOpenAIMultipartEndpoint = async (params: {
  userId: string;
  apiKeyId: string;
  requestId: string;
  endpoint: string;
  upstreamPath: string;
  model: string;
  body: Buffer;
  contentType: string;
}): Promise<RelayExecutionResult> => executeRelay({
  userId: params.userId,
  apiKeyId: params.apiKeyId,
  requestId: params.requestId,
  model: params.model,
  endpoint: params.endpoint,
  providers: getOpenAICompatibleProviders(),
  send: (channel) => sendOpenAIMultipartEndpoint(channel, params.upstreamPath, params.body, params.contentType, params.model),
});
