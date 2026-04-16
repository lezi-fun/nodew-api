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

const formatErrorMessage = (message: unknown): string => {
  if (typeof message === 'string') {
    try {
      const parsed = JSON.parse(message) as Array<{ message?: string; path?: string[] }>;

      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
          .map((issue) => {
            const field = issue.path?.[0];

            if (field === 'password') {
              return 'Password must contain at least 8 characters';
            }

            if (field === 'username') {
              return 'Username must be 3-32 characters and use only letters, numbers, underscores, or dashes';
            }

            if (field === 'email') {
              return 'Email address is invalid';
            }

            if (field === 'displayName') {
              return 'Display name must be between 1 and 64 characters';
            }

            return issue.message ?? 'Request failed';
          })
          .join('\n');
      }
    } catch {
      return message;
    }

    return message;
  }

  return 'Request failed';
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
    throw new Error(formatErrorMessage(data.message));
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
