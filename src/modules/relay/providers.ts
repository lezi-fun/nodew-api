import type { RelayChannel } from './types.js';

export const openAICompatibleProviders = [
  'openai',
  'openai-compatible',
  'openrouter',
  'deepseek',
  'siliconflow',
  'xai',
  'moonshot',
  'mistral',
  'perplexity',
  'together',
  'groq',
  'fireworks',
  'ollama',
] as const;

const defaultOpenAICompatibleBaseUrls: Record<string, string> = {
  openai: 'https://api.openai.com/v1',
  'openai-compatible': 'https://api.openai.com/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  deepseek: 'https://api.deepseek.com/v1',
  siliconflow: 'https://api.siliconflow.cn/v1',
  xai: 'https://api.x.ai/v1',
  moonshot: 'https://api.moonshot.cn/v1',
  mistral: 'https://api.mistral.ai/v1',
  perplexity: 'https://api.perplexity.ai',
  together: 'https://api.together.xyz/v1',
  groq: 'https://api.groq.com/openai/v1',
  fireworks: 'https://api.fireworks.ai/inference/v1',
  ollama: 'http://127.0.0.1:11434/v1',
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

export const getOpenAICompatibleProviders = () => [...openAICompatibleProviders];

export const getOpenAICompatibleBaseUrl = (channel: Pick<RelayChannel, 'provider' | 'baseUrl'>) =>
  channel.baseUrl ?? defaultOpenAICompatibleBaseUrls[channel.provider] ?? defaultOpenAICompatibleBaseUrls.openai!;

export const getProviderExtraHeaders = (channel: { metadata?: unknown }) => {
  const metadata = isRecord(channel.metadata) ? channel.metadata : {};
  const headers = metadata.headers;

  if (!isRecord(headers)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(headers)
      .filter((entry): entry is [string, string] =>
        typeof entry[0] === 'string' &&
        typeof entry[1] === 'string' &&
        entry[0].toLowerCase() !== 'authorization' &&
        entry[0].toLowerCase() !== 'content-type',
      ),
  );
};
