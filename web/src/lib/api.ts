export type SetupStatus = {
  isInitialized: boolean;
  hasAdmin: boolean;
};

export type ServiceStatus = {
  status: string;
  service: string;
  version: string;
};

export type CurrentUser = {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  role: 'USER' | 'ADMIN';
  status: 'ACTIVE' | 'DISABLED';
  quotaRemaining: string;
  quotaUsed: string;
  lastLoginAt: string | null;
  settings: Record<string, unknown> | null;
  createdAt: string;
};

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(path, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message ?? 'Request failed');
  }

  return data as T;
};

export const api = {
  getSetupStatus: () => request<SetupStatus>('/api/setup'),
  initialize: (payload: {
    email: string;
    username: string;
    password: string;
    displayName?: string;
  }) => request<{ user: CurrentUser; isInitialized: boolean }>('/api/setup', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  login: (payload: { email: string; password: string }) =>
    request<{ user: CurrentUser }>('/api/user/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  logout: () => request<{ success: boolean }>('/api/user/logout', { method: 'POST' }),
  getCurrentUser: () => request<{ user: CurrentUser }>('/api/user/self'),
  getStatus: () => request<ServiceStatus>('/api/status'),
};
