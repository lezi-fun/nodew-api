import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import { api, type AppStatus } from '../lib/api';

type StatusContextValue = {
  status: AppStatus | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

export const StatusContext = createContext<StatusContextValue>({
  status: null,
  loading: true,
  refresh: async () => {},
});

export function StatusProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AppStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const next = await api.getStatus();
      setStatus(next);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(() => ({ status, loading, refresh }), [status, loading, refresh]);

  return <StatusContext.Provider value={value}>{children}</StatusContext.Provider>;
}
