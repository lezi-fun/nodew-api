import { executeRelay } from './executor.js';
import { sendOpenAIEmbeddings } from './openai-adapter.js';
import { getOpenAICompatibleProviders } from './providers.js';
import type { EmbeddingsBody, RelayExecutionResult } from './types.js';

export const relayEmbeddings = async (params: {
  userId: string;
  apiKeyId: string;
  requestId: string;
  body: EmbeddingsBody;
}): Promise<RelayExecutionResult> => {
  return executeRelay({
    userId: params.userId,
    apiKeyId: params.apiKeyId,
    requestId: params.requestId,
    model: params.body.model,
    endpoint: '/v1/embeddings',
    providers: getOpenAICompatibleProviders(),
    send: (channel) => sendOpenAIEmbeddings(channel, params.body),
  });
};
