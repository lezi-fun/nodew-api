import { prisma } from '../../lib/prisma.js';
import {
  extractRelayErrorMessage,
  formatRelayAttempt,
  relayRetryLimit,
  selectRelayChannels,
  shouldRetryRelay,
  summarizeRelayAttempts,
} from './channel-selector.js';
import { sendGeminiGenerateContent } from './gemini-adapter.js';
import { sendGeminiViaOpenAIChatCompletion } from './gemini-openai-adapter.js';
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
    : await selectRelayChannels(model, ['openai']);
  const channels = nativeChannels.length > 0 ? nativeChannels : bridgeChannels;
  const useOpenAIBridge = nativeChannels.length === 0 && bridgeChannels.length > 0;

  if (channels.length === 0) {
    throw new Error('No active channel available for the requested model');
  }

  const startedAt = Date.now();
  const attempts = [] as RelayExecutionResult['attempts'];
  let lastResult: RelayExecutionResult['result'] | null = null;
  let lastChannel: RelayExecutionResult['channel'] | null = null;

  for (const channel of channels.slice(0, relayRetryLimit + 1)) {
    const result = useOpenAIBridge
      ? await sendGeminiViaOpenAIChatCompletion(channel, model, params.body)
      : await sendGeminiGenerateContent(channel, params.path, params.body);
    const errorMessage = result.statusCode >= 200 && result.statusCode < 300 ? null : extractRelayErrorMessage(result.body);

    attempts.push(formatRelayAttempt(channel, result.statusCode, errorMessage));
    lastResult = result;
    lastChannel = channel;

    if (result.statusCode >= 200 && result.statusCode < 300) {
      await prisma.usageLog.create({
        data: {
          userId: params.userId,
          apiKeyId: params.apiKeyId,
          channelId: channel.id,
          requestId: params.requestId,
          provider: channel.provider,
          model: channel.model ?? model,
          endpoint: `/v1beta${params.path}`,
          promptTokens: result.promptTokens,
          completionTokens: result.completionTokens,
          totalTokens: result.totalTokens,
          statusCode: result.statusCode,
          success: true,
          errorMessage: attempts.length > 1 ? `fallback chain: ${summarizeRelayAttempts(attempts)}` : null,
          latencyMs: Date.now() - startedAt,
        },
      });

      return {
        result,
        channel,
        attempts,
      };
    }

    if (!shouldRetryRelay(result.statusCode)) {
      break;
    }
  }

  await prisma.usageLog.create({
    data: {
      userId: params.userId,
      apiKeyId: params.apiKeyId,
      channelId: lastChannel?.id ?? null,
      requestId: params.requestId,
      provider: lastChannel?.provider ?? 'unknown',
      model: lastChannel?.model ?? model,
      endpoint: `/v1beta${params.path}`,
      promptTokens: lastResult?.promptTokens ?? 0,
      completionTokens: lastResult?.completionTokens ?? 0,
      totalTokens: lastResult?.totalTokens ?? 0,
      statusCode: lastResult?.statusCode ?? 502,
      success: false,
      errorMessage: attempts.length > 0 ? summarizeRelayAttempts(attempts) : 'Upstream request failed',
      latencyMs: Date.now() - startedAt,
    },
  });

  return {
    result: lastResult ?? {
      statusCode: 502,
      body: { error: { message: 'Upstream request failed' } },
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    },
    channel: lastChannel ?? channels[0]!,
    attempts,
  };
};
