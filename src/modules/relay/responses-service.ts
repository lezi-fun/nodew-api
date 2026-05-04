import { executeRelay } from './executor.js';
import { sendOpenAIResponses } from './openai-adapter.js';
import { getOpenAICompatibleProviders } from './providers.js';
import type { RelayExecutionResult, ResponsesBody } from './types.js';

export const relayResponses = async (params: {
  userId: string;
  apiKeyId: string;
  requestId: string;
  body: ResponsesBody;
}): Promise<RelayExecutionResult> => {
  return executeRelay({
    userId: params.userId,
    apiKeyId: params.apiKeyId,
    requestId: params.requestId,
    model: params.body.model,
    endpoint: '/v1/responses',
    providers: getOpenAICompatibleProviders(),
    send: (channel) => sendOpenAIResponses(channel, params.body),
  });
};
