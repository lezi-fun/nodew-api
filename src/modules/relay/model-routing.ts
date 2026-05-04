import type { RelayChannel } from './types.js';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

const splitModels = (value: string | null | undefined) =>
  value
    ?.split(',')
    .map((model) => model.trim())
    .filter(Boolean) ?? [];

const readMetadata = (channel: Pick<RelayChannel, 'metadata'>) =>
  isRecord(channel.metadata) ? channel.metadata : {};

const readModels = (metadata: Record<string, unknown>) => {
  const models = metadata.models ?? metadata.modelList;

  if (!Array.isArray(models)) {
    return [];
  }

  return models.filter((model): model is string => typeof model === 'string' && model.trim().length > 0);
};

const readModelMap = (metadata: Record<string, unknown>) => {
  const modelMap = metadata.modelMap ?? metadata.model_mapping;

  if (!isRecord(modelMap)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(modelMap).filter((entry): entry is [string, string] =>
      typeof entry[0] === 'string' && typeof entry[1] === 'string' && entry[1].trim().length > 0,
    ),
  );
};

export const getChannelSupportedModels = (channel: Pick<RelayChannel, 'model' | 'metadata'>) => {
  const metadata = readMetadata(channel);
  const modelMap = readModelMap(metadata);

  return [...new Set([
    ...splitModels(channel.model),
    ...readModels(metadata),
    ...Object.keys(modelMap),
  ])];
};

export const channelSupportsModel = (channel: Pick<RelayChannel, 'model' | 'metadata'>, requestedModel: string) => {
  const supportedModels = getChannelSupportedModels(channel);

  return supportedModels.length === 0 || supportedModels.includes(requestedModel);
};

export const resolveUpstreamModel = (channel: Pick<RelayChannel, 'model' | 'metadata'>, requestedModel: string) => {
  const metadata = readMetadata(channel);
  const modelMap = readModelMap(metadata);
  const mappedModel = modelMap[requestedModel];

  if (mappedModel) {
    return mappedModel;
  }

  const configuredModels = splitModels(channel.model);

  if (configuredModels.length === 1 && configuredModels[0] !== requestedModel) {
    return configuredModels[0]!;
  }

  return requestedModel;
};
