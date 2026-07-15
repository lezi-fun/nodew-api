export const createSharedRequestCache = <T>() => {
  const requests = new Map<string, Promise<T>>();

  return {
    run(key: string, factory: () => Promise<T>) {
      const existing = requests.get(key);

      if (existing) {
        return existing;
      }

      const request = factory();
      requests.set(key, request);
      void request.finally(() => {
        if (requests.get(key) === request) {
          requests.delete(key);
        }
      }).catch(() => undefined);

      return request;
    },
  };
};
