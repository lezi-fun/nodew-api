import { executeRelay } from './executor.js';
import { sendOpenAIChatCompletion } from './openai-adapter.js';
import { getOpenAICompatibleProviders } from './providers.js';
import type { ChatCompletionsBody, RelayExecutionResult } from './types.js';

export const relayChatCompletion = async (params: {
  userId: string;
  apiKeyId: string;
  requestId: string;
  body: ChatCompletionsBody;
}): Promise<RelayExecutionResult> => {
  return executeRelay({
    userId: params.userId,
    apiKeyId: params.apiKeyId,
    requestId: params.requestId,
    model: params.body.model,
    endpoint: '/v1/chat/completions',
    providers: getOpenAICompatibleProviders(),
    send: (channel) => sendOpenAIChatCompletion(channel, params.body),
  });
};
