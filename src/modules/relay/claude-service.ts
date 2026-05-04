import { sendClaudeMessages } from './claude-adapter.js';
import { executeRelay } from './executor.js';
import type { ClaudeMessagesBody, RelayExecutionResult } from './types.js';

export const relayClaudeMessages = async (params: {
  userId: string;
  apiKeyId: string;
  requestId: string;
  body: ClaudeMessagesBody;
  anthropicVersion?: string;
}): Promise<RelayExecutionResult> => {
  return executeRelay({
    userId: params.userId,
    apiKeyId: params.apiKeyId,
    requestId: params.requestId,
    model: params.body.model,
    endpoint: '/v1/messages',
    providers: ['anthropic'],
    send: (channel) => sendClaudeMessages(channel, params.body, params.anthropicVersion),
  });
};
