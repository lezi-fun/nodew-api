import {
  extractRelayErrorMessage,
  formatRelayAttempt,
  relayRetryLimit,
  selectRelayChannels,
  shouldRetryRelay,
  summarizeRelayAttempts,
} from './balancer.js';
import { writeRelayUsageLog } from './billing.js';
import { recordRelayChannelFailure, recordRelayChannelSuccess } from './channel-health.js';
import { reserveRelayChannelSlot } from './rate-limit.js';
import type { RelayChannel, RelayExecutionResult, RelayResult } from './types.js';

type ExecuteRelayParams = {
  userId: string;
  apiKeyId: string;
  requestId: string;
  model: string;
  endpoint: string;
  providers: string[];
  send: (channel: RelayChannel) => Promise<RelayResult>;
};

const toRelayErrorResult = (error: unknown): RelayResult => ({
  statusCode: 502,
  body: {
    error: {
      message: error instanceof Error ? error.message : 'Upstream request failed',
    },
  },
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
});

const buildNoChannelResult = (): RelayResult => ({
  statusCode: 503,
  body: {
    error: {
      message: 'No active channel available for the requested model',
    },
  },
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
});

const buildRateLimitedResult = (): RelayResult => ({
  statusCode: 429,
  body: {
    error: {
      message: 'All matching relay channels are rate limited',
    },
  },
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
});

const isSuccessStatus = (statusCode: number) => statusCode >= 200 && statusCode < 300;

export const executeRelay = async (params: ExecuteRelayParams): Promise<RelayExecutionResult> => {
  const channels = await selectRelayChannels(params.model, params.providers);
  const startedAt = Date.now();

  if (channels.length === 0) {
    const result = buildNoChannelResult();

    await writeRelayUsageLog({
      userId: params.userId,
      apiKeyId: params.apiKeyId,
      requestId: params.requestId,
      channel: null,
      provider: params.providers[0] ?? 'unknown',
      model: params.model,
      endpoint: params.endpoint,
      result,
      success: false,
      errorMessage: 'No active channel available for the requested model',
      latencyMs: Date.now() - startedAt,
      attempts: [],
    });

    return {
      result,
      channel: null,
      attempts: [],
    };
  }

  const attempts: RelayExecutionResult['attempts'] = [];
  let lastResult: RelayResult | null = null;
  let lastChannel: RelayChannel | null = null;
  let attemptedUpstream = false;
  let skippedRateLimitedChannel = false;
  let upstreamAttempts = 0;

  for (const channel of channels) {
    if (!reserveRelayChannelSlot(channel)) {
      const result = {
        statusCode: 429,
        body: { error: { message: 'Channel rate limit exceeded' } },
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      };

      attempts.push(formatRelayAttempt(channel, result.statusCode, 'Channel rate limit exceeded'));
      lastResult = result;
      lastChannel = channel;
      skippedRateLimitedChannel = true;
      continue;
    }

    if (upstreamAttempts >= relayRetryLimit + 1) {
      break;
    }

    attemptedUpstream = true;
    upstreamAttempts += 1;
    const result = await params.send(channel).catch(toRelayErrorResult);
    const errorMessage = isSuccessStatus(result.statusCode) ? null : extractRelayErrorMessage(result.body);

    attempts.push(formatRelayAttempt(channel, result.statusCode, errorMessage));
    lastResult = result;
    lastChannel = channel;

    if (isSuccessStatus(result.statusCode)) {
      await recordRelayChannelSuccess(channel);

      await writeRelayUsageLog({
        userId: params.userId,
        apiKeyId: params.apiKeyId,
        requestId: params.requestId,
        channel,
        provider: channel.provider,
        model: params.model,
        endpoint: params.endpoint,
        result,
        success: true,
        errorMessage: attempts.length > 1 ? `fallback chain: ${summarizeRelayAttempts(attempts)}` : null,
        latencyMs: Date.now() - startedAt,
        attempts,
      });

      return {
        result,
        channel,
        attempts,
      };
    }

    await recordRelayChannelFailure(channel, result.statusCode, errorMessage);

    if (!shouldRetryRelay(result.statusCode)) {
      break;
    }
  }

  const result = skippedRateLimitedChannel && !attemptedUpstream
    ? buildRateLimitedResult()
    : lastResult ?? toRelayErrorResult(new Error('Upstream request failed'));

  await writeRelayUsageLog({
    userId: params.userId,
    apiKeyId: params.apiKeyId,
    requestId: params.requestId,
    channel: lastChannel,
    provider: lastChannel?.provider ?? params.providers[0] ?? 'unknown',
    model: params.model,
    endpoint: params.endpoint,
    result,
    success: false,
    errorMessage: attempts.length > 0 ? summarizeRelayAttempts(attempts) : 'Upstream request failed',
    latencyMs: Date.now() - startedAt,
    attempts,
  });

  return {
    result,
    channel: lastChannel,
    attempts,
  };
};
