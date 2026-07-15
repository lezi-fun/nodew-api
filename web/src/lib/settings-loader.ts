export type SettingsResourceLoaders = Record<string, () => Promise<unknown>>;

type LoadedResources<T extends SettingsResourceLoaders> = {
  [K in keyof T]?: Awaited<ReturnType<T[K]>>;
};

export type SettingsResourceError<T extends SettingsResourceLoaders> = {
  key: keyof T;
  message: string;
};

export const loadSettingsResources = async <T extends SettingsResourceLoaders>(loaders: T) => {
  const entries = Object.entries(loaders) as Array<[keyof T, T[keyof T]]>;
  const settled = await Promise.allSettled(entries.map(([, load]) => load()));
  const resources: LoadedResources<T> = {};
  const errors: Array<SettingsResourceError<T>> = [];

  settled.forEach((result, index) => {
    const [key] = entries[index]!;

    if (result.status === 'fulfilled') {
      resources[key] = result.value as LoadedResources<T>[typeof key];
      return;
    }

    errors.push({
      key,
      message: result.reason instanceof Error ? result.reason.message : 'Failed to load settings resource',
    });
  });

  return { resources, errors };
};
