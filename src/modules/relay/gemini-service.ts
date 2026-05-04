import { selectRelayChannels } from './balancer.js';
import { executeRelay } from './executor.js';
import { sendGeminiGenerateContent } from './gemini-adapter.js';
import { sendGeminiViaOpenAIChatCompletion } from './gemini-openai-adapter.js';
import { getOpenAICompatibleProviders } from './providers.js';
import type { GeminiGenerateContentBody, RelayExecutionResult } from './types.js';

const extractGeminiModel = (path: string) => {
  const withoutQuery = path.split('?')[0] ?? path;
  const match = withoutQuery.match(/^\/models\/([^:]+):([^/?]+)$/);

  if (!match) {
    throw new Error('Invalid Gemini relay path');
  }

  return match[1]!;
};

const isStreamPath = (path: string) => path.includes(':streamGenerateContent');

export const relayGeminiGenerateContent = async (params: {
  userId: string;
  apiKeyId: string;
  requestId: string;
  path: string;
  body: GeminiGenerateContentBody;
}): Promise<RelayExecutionResult> => {
  const model = extractGeminiModel(params.path);
  const nativeChannels = await selectRelayChannels(model, ['gemini']);
  const bridgeChannels = isStreamPath(params.path) || nativeChannels.length > 0
    ? []
    : await selectRelayChannels(model, getOpenAICompatibleProviders());
  const channels = nativeChannels.length > 0 ? nativeChannels : bridgeChannels;
  const useOpenAIBridge = nativeChannels.length === 0 && bridgeChannels.length > 0;
  const providers = useOpenAIBridge ? getOpenAICompatibleProviders() : ['gemini'];

  if (channels.length === 0) {
    return executeRelay({
      userId: params.userId,
      apiKeyId: params.apiKeyId,
      requestId: params.requestId,
      model,
      endpoint: `/v1beta${params.path}`,
      providers,
      send: (channel) => sendGeminiGenerateContent(channel, params.path, params.body),
    });
  }

  return executeRelay({
    userId: params.userId,
    apiKeyId: params.apiKeyId,
    requestId: params.requestId,
    model,
    endpoint: `/v1beta${params.path}`,
    providers,
    send: (channel) => useOpenAIBridge
      ? sendGeminiViaOpenAIChatCompletion(channel, model, params.body)
      : sendGeminiGenerateContent(channel, params.path, params.body),
  });
};
