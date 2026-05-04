import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { api, type CurrentUser } from '../lib/api';
import { StatusContext } from './Status';

type UserContextValue = {
  user: CurrentUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: CurrentUser | null) => void;
};

export const UserContext = createContext<UserContextValue>({
  user: null,
  loading: true,
  refresh: async () => {},
  logout: async () => {},
  setUser: () => {},
});

export function UserProvider({ children }: { children: ReactNode }) {
  const { status, loading: statusLoading } = useContext(StatusContext);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.getCurrentUser();
      setUser(response.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    setUser(null);
  }, []);

  useEffect(() => {
    if (statusLoading) {
      return;
    }

    if (status?.setup?.isInitialized === false) {
      setUser(null);
      setLoading(false);
      return;
    }

    void refresh();
  }, [refresh, status?.setup?.isInitialized, statusLoading]);

  const value = useMemo(
    () => ({ user, loading, refresh, logout, setUser }),
    [user, loading, refresh, logout],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}
