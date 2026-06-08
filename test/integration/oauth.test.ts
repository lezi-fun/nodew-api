import { prisma } from '../../src/lib/prisma.js';
import { closeTestApp, createTestApp } from '../helpers/app.js';
import { mockFetchSequence } from '../helpers/fetch.js';
import { createSessionForUser, createUser } from '../helpers/factories.js';

const extractCookieValue = (response: { headers: Record<string, unknown> }, cookieName: string) => {
  const rawSetCookie = response.headers['set-cookie'];
  const cookies = Array.isArray(rawSetCookie)
    ? rawSetCookie
    : typeof rawSetCookie === 'string'
      ? [rawSetCookie]
      : [];
  const entry = cookies.find((cookie) => typeof cookie === 'string' && cookie.startsWith(`${cookieName}=`));
  const rawValue = entry ? entry.split(';')[0]?.slice(cookieName.length + 1) ?? null : null;

  if (!rawValue) {
    return null;
  }

  try {
    return decodeURIComponent(rawValue);
  } catch {
    return rawValue;
  }
};

const withGitHubOAuthEnv = () => {
  const previous = {
    appBaseUrl: process.env.APP_BASE_URL,
    clientId: process.env.GITHUB_OAUTH_CLIENT_ID,
    clientSecret: process.env.GITHUB_OAUTH_CLIENT_SECRET,
  };

  process.env.APP_BASE_URL = 'http://127.0.0.1:3000';
  process.env.GITHUB_OAUTH_CLIENT_ID = 'github-client-id';
  process.env.GITHUB_OAUTH_CLIENT_SECRET = 'github-client-secret';

  return () => {
    if (previous.appBaseUrl === undefined) {
      delete process.env.APP_BASE_URL;
    } else {
      process.env.APP_BASE_URL = previous.appBaseUrl;
    }

    if (previous.clientId === undefined) {
      delete process.env.GITHUB_OAUTH_CLIENT_ID;
    } else {
      process.env.GITHUB_OAUTH_CLIENT_ID = previous.clientId;
    }

    if (previous.clientSecret === undefined) {
      delete process.env.GITHUB_OAUTH_CLIENT_SECRET;
    } else {
      process.env.GITHUB_OAUTH_CLIENT_SECRET = previous.clientSecret;
    }
  };
};

const withLinuxDOOAuthEnv = () => {
  const previous = {
    appBaseUrl: process.env.APP_BASE_URL,
    clientId: process.env.LINUXDO_OAUTH_CLIENT_ID,
    clientSecret: process.env.LINUXDO_OAUTH_CLIENT_SECRET,
  };

  process.env.APP_BASE_URL = 'http://127.0.0.1:3000';
  process.env.LINUXDO_OAUTH_CLIENT_ID = 'linuxdo-client-id';
  process.env.LINUXDO_OAUTH_CLIENT_SECRET = 'linuxdo-client-secret';

  return () => {
    if (previous.appBaseUrl === undefined) {
      delete process.env.APP_BASE_URL;
    } else {
      process.env.APP_BASE_URL = previous.appBaseUrl;
    }

    if (previous.clientId === undefined) {
      delete process.env.LINUXDO_OAUTH_CLIENT_ID;
    } else {
      process.env.LINUXDO_OAUTH_CLIENT_ID = previous.clientId;
    }

    if (previous.clientSecret === undefined) {
      delete process.env.LINUXDO_OAUTH_CLIENT_SECRET;
    } else {
      process.env.LINUXDO_OAUTH_CLIENT_SECRET = previous.clientSecret;
    }
  };
};

const withOIDCOAuthEnv = () => {
  const previous = {
    appBaseUrl: process.env.APP_BASE_URL,
    clientId: process.env.OIDC_OAUTH_CLIENT_ID,
    clientSecret: process.env.OIDC_OAUTH_CLIENT_SECRET,
    authorizationUrl: process.env.OIDC_OAUTH_AUTHORIZATION_URL,
    tokenUrl: process.env.OIDC_OAUTH_TOKEN_URL,
    userInfoUrl: process.env.OIDC_OAUTH_USERINFO_URL,
    scope: process.env.OIDC_OAUTH_SCOPE,
  };

  process.env.APP_BASE_URL = 'http://127.0.0.1:3000';
  process.env.OIDC_OAUTH_CLIENT_ID = 'oidc-client-id';
  process.env.OIDC_OAUTH_CLIENT_SECRET = 'oidc-client-secret';
  process.env.OIDC_OAUTH_AUTHORIZATION_URL = 'https://id.example.test/oauth2/authorize';
  process.env.OIDC_OAUTH_TOKEN_URL = 'https://id.example.test/oauth2/token';
  process.env.OIDC_OAUTH_USERINFO_URL = 'https://id.example.test/oauth2/userinfo';
  process.env.OIDC_OAUTH_SCOPE = 'openid profile email';

  return () => {
    if (previous.appBaseUrl === undefined) {
      delete process.env.APP_BASE_URL;
    } else {
      process.env.APP_BASE_URL = previous.appBaseUrl;
    }

    if (previous.clientId === undefined) {
      delete process.env.OIDC_OAUTH_CLIENT_ID;
    } else {
      process.env.OIDC_OAUTH_CLIENT_ID = previous.clientId;
    }

    if (previous.clientSecret === undefined) {
      delete process.env.OIDC_OAUTH_CLIENT_SECRET;
    } else {
      process.env.OIDC_OAUTH_CLIENT_SECRET = previous.clientSecret;
    }

    if (previous.authorizationUrl === undefined) {
      delete process.env.OIDC_OAUTH_AUTHORIZATION_URL;
    } else {
      process.env.OIDC_OAUTH_AUTHORIZATION_URL = previous.authorizationUrl;
    }

    if (previous.tokenUrl === undefined) {
      delete process.env.OIDC_OAUTH_TOKEN_URL;
    } else {
      process.env.OIDC_OAUTH_TOKEN_URL = previous.tokenUrl;
    }

    if (previous.userInfoUrl === undefined) {
      delete process.env.OIDC_OAUTH_USERINFO_URL;
    } else {
      process.env.OIDC_OAUTH_USERINFO_URL = previous.userInfoUrl;
    }

    if (previous.scope === undefined) {
      delete process.env.OIDC_OAUTH_SCOPE;
    } else {
      process.env.OIDC_OAUTH_SCOPE = previous.scope;
    }
  };
};

const enableRegistration = async () => {
  await prisma.setupState.create({
    data: {
      isInitialized: true,
      initializedAt: new Date(),
    },
  });

  await prisma.systemOption.create({
    data: {
      key: 'registration_enabled',
      value: 'true',
    },
  });
};

describe('oauth github integration', () => {
  it('creates an oauth state cookie and authorize url for github', async () => {
    const restoreEnv = withGitHubOAuthEnv();
    const app = await createTestApp();

    try {
      const response = await app.inject({
        method: 'GET',
        url: '/api/oauth/state?provider=github&redirectTo=/console',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        success: true,
        data: {
          state: expect.any(String),
        },
      });
      expect(response.json().data.authorizeUrl).toContain('https://github.com/login/oauth/authorize');
      expect(response.json().data.authorizeUrl).toContain('client_id=github-client-id');
      expect(response.json().data.authorizeUrl).toContain(encodeURIComponent('http://127.0.0.1:3000/oauth/github'));
      expect(extractCookieValue(response, 'nodew_oauth_state')).toBeTruthy();
    } finally {
      restoreEnv();
      await closeTestApp(app);
    }
  });

  it('creates a user session from the github callback when registration is enabled', async () => {
    const restoreEnv = withGitHubOAuthEnv();
    await enableRegistration();
    const app = await createTestApp();

    try {
      const stateResponse = await app.inject({
        method: 'GET',
        url: '/api/oauth/state?provider=github&redirectTo=/console',
      });
      const stateCookie = extractCookieValue(stateResponse, 'nodew_oauth_state');
      const state = stateResponse.json().data.state as string;

      expect(stateCookie).toBeTruthy();

      mockFetchSequence([
        {
          body: {
            access_token: 'github-access-token',
            token_type: 'bearer',
            scope: 'read:user user:email',
          },
        },
        {
          body: {
            id: 12345,
            login: 'octocat',
            name: 'Octo Cat',
            avatar_url: 'https://avatars.example.test/octocat.png',
            email: null,
          },
        },
        {
          body: [
            {
              email: 'octocat@test.local',
              verified: true,
              primary: true,
            },
          ],
        },
      ]);

      const callbackResponse = await app.inject({
        method: 'GET',
        url: `/api/oauth/github?code=oauth-code&state=${state}`,
        cookies: {
          nodew_oauth_state: stateCookie!,
        },
      });

      expect(callbackResponse.statusCode).toBe(200);
      expect(callbackResponse.json()).toMatchObject({
        success: true,
        action: 'login',
        redirectTo: '/console',
        user: {
          email: 'octocat@test.local',
          username: 'octocat',
        },
      });
      expect(extractCookieValue(callbackResponse, 'nodew_session')).toBeTruthy();

      const storedUser = await prisma.user.findUnique({
        where: { email: 'octocat@test.local' },
        select: {
          username: true,
          displayName: true,
          emailVerifiedAt: true,
        },
      });

      expect(storedUser).toMatchObject({
        username: 'octocat',
        displayName: 'Octo Cat',
      });
      expect(storedUser?.emailVerifiedAt).toBeTruthy();

      const binding = await prisma.userOAuthBinding.findFirst({
        where: {
          provider: 'github',
          providerUserId: '12345',
        },
        select: {
          email: true,
          displayName: true,
        },
      });

      expect(binding).toMatchObject({
        email: 'octocat@test.local',
        displayName: 'Octo Cat',
      });
    } finally {
      restoreEnv();
      await closeTestApp(app);
    }
  });

  it('binds a github account to the current user when the callback runs in bind mode', async () => {
    const restoreEnv = withGitHubOAuthEnv();
    const user = await createUser();
    const token = await createSessionForUser(user.id);
    const app = await createTestApp();

    try {
      const stateResponse = await app.inject({
        method: 'GET',
        url: '/api/oauth/state?provider=github&mode=bind&redirectTo=/console/personal',
        cookies: {
          nodew_session: app.signCookie(token),
        },
      });
      const stateCookie = extractCookieValue(stateResponse, 'nodew_oauth_state');
      const state = stateResponse.json().data.state as string;

      expect(stateCookie).toBeTruthy();

      mockFetchSequence([
        {
          body: {
            access_token: 'github-access-token',
            token_type: 'bearer',
            scope: 'read:user user:email',
          },
        },
        {
          body: {
            id: 67890,
            login: 'bindcat',
            name: 'Bind Cat',
            avatar_url: 'https://avatars.example.test/bindcat.png',
            email: 'bindcat@test.local',
          },
        },
        {
          body: [
            {
              email: 'bindcat@test.local',
              verified: true,
              primary: true,
            },
          ],
        },
      ]);

      const callbackResponse = await app.inject({
        method: 'GET',
        url: `/api/oauth/github?code=oauth-bind-code&state=${state}`,
        cookies: {
          nodew_session: app.signCookie(token),
          nodew_oauth_state: stateCookie!,
        },
      });

      expect(callbackResponse.statusCode).toBe(200);
      expect(callbackResponse.json()).toEqual({
        success: true,
        action: 'bind',
        redirectTo: '/console/personal',
      });

      const binding = await prisma.userOAuthBinding.findFirst({
        where: {
          userId: user.id,
          provider: 'github',
        },
        select: {
          providerUserId: true,
          email: true,
          displayName: true,
        },
      });

      expect(binding).toEqual({
        providerUserId: '67890',
        email: 'bindcat@test.local',
        displayName: 'Bind Cat',
      });
    } finally {
      restoreEnv();
      await closeTestApp(app);
    }
  });

  it('rejects a bind callback when the initiating session is missing', async () => {
    const restoreEnv = withGitHubOAuthEnv();
    const user = await createUser();
    const token = await createSessionForUser(user.id);
    const app = await createTestApp();

    try {
      const stateResponse = await app.inject({
        method: 'GET',
        url: '/api/oauth/state?provider=github&mode=bind&redirectTo=/console/personal',
        cookies: {
          nodew_session: app.signCookie(token),
        },
      });
      const stateCookie = extractCookieValue(stateResponse, 'nodew_oauth_state');
      const state = stateResponse.json().data.state as string;
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        throw new Error('fetch should not be called');
      });

      const callbackResponse = await app.inject({
        method: 'GET',
        url: `/api/oauth/github?code=oauth-bind-code&state=${state}`,
        cookies: {
          nodew_oauth_state: stateCookie!,
        },
      });

      expect(callbackResponse.statusCode).toBe(403);
      expect(callbackResponse.json().message).toBe('OAuth binding session is invalid or expired');
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      restoreEnv();
      await closeTestApp(app);
    }
  });

  it('rejects a bind callback when it returns under a different user session', async () => {
    const restoreEnv = withGitHubOAuthEnv();
    const user = await createUser();
    const otherUser = await createUser();
    const token = await createSessionForUser(user.id);
    const otherToken = await createSessionForUser(otherUser.id);
    const app = await createTestApp();

    try {
      const stateResponse = await app.inject({
        method: 'GET',
        url: '/api/oauth/state?provider=github&mode=bind&redirectTo=/console/personal',
        cookies: {
          nodew_session: app.signCookie(token),
        },
      });
      const stateCookie = extractCookieValue(stateResponse, 'nodew_oauth_state');
      const state = stateResponse.json().data.state as string;
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        throw new Error('fetch should not be called');
      });

      const callbackResponse = await app.inject({
        method: 'GET',
        url: `/api/oauth/github?code=oauth-bind-code&state=${state}`,
        cookies: {
          nodew_session: app.signCookie(otherToken),
          nodew_oauth_state: stateCookie!,
        },
      });

      expect(callbackResponse.statusCode).toBe(403);
      expect(callbackResponse.json().message).toBe('OAuth binding session is invalid or expired');
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      restoreEnv();
      await closeTestApp(app);
    }
  });

  it('lists only the current user oauth bindings', async () => {
    const user = await createUser();
    const otherUser = await createUser();
    const token = await createSessionForUser(user.id);
    const app = await createTestApp();

    try {
      await prisma.userOAuthBinding.createMany({
        data: [
          {
            userId: user.id,
            provider: 'github',
            providerUserId: 'github-user-1',
            email: 'github-user-1@test.local',
            displayName: 'GitHub User One',
          },
          {
            userId: otherUser.id,
            provider: 'github',
            providerUserId: 'github-user-2',
            email: 'github-user-2@test.local',
            displayName: 'GitHub User Two',
          },
        ],
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/user/oauth/bindings',
        cookies: {
          nodew_session: app.signCookie(token),
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().items).toEqual([
        expect.objectContaining({
          provider: 'github',
          providerName: 'GitHub',
          providerUserId: 'github-user-1',
          email: 'github-user-1@test.local',
          displayName: 'GitHub User One',
        }),
      ]);
    } finally {
      await closeTestApp(app);
    }
  });

  it('unbinds the current user oauth binding', async () => {
    const user = await createUser();
    const token = await createSessionForUser(user.id);
    const app = await createTestApp();

    try {
      const binding = await prisma.userOAuthBinding.create({
        data: {
          userId: user.id,
          provider: 'github',
          providerUserId: 'github-user-delete',
          email: 'github-delete@test.local',
          displayName: 'GitHub Delete',
        },
      });

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/user/oauth/bindings/github',
        cookies: {
          nodew_session: app.signCookie(token),
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        success: true,
      });

      const deletedBinding = await prisma.userOAuthBinding.findUnique({
        where: { id: binding.id },
      });

      expect(deletedBinding).toBeNull();
    } finally {
      await closeTestApp(app);
    }
  });
});


describe('oauth linuxdo integration', () => {
  it('creates an oauth state cookie and authorize url for linuxdo', async () => {
    const restoreEnv = withLinuxDOOAuthEnv();
    const app = await createTestApp();

    try {
      const response = await app.inject({
        method: 'GET',
        url: '/api/oauth/state?provider=linuxdo&redirectTo=/console',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        success: true,
        data: {
          state: expect.any(String),
        },
      });
      expect(response.json().data.authorizeUrl).toContain('https://connect.linux.do/oauth2/authorize');
      expect(response.json().data.authorizeUrl).toContain('client_id=linuxdo-client-id');
      expect(response.json().data.authorizeUrl).toContain(encodeURIComponent('http://127.0.0.1:3000/oauth/linuxdo'));
      expect(extractCookieValue(response, 'nodew_oauth_state')).toBeTruthy();
    } finally {
      restoreEnv();
      await closeTestApp(app);
    }
  });

  it('creates a user session from the linuxdo callback when registration is enabled', async () => {
    const restoreEnv = withLinuxDOOAuthEnv();
    await enableRegistration();
    const app = await createTestApp();

    try {
      const stateResponse = await app.inject({
        method: 'GET',
        url: '/api/oauth/state?provider=linuxdo&redirectTo=/console',
      });
      const stateCookie = extractCookieValue(stateResponse, 'nodew_oauth_state');
      const state = stateResponse.json().data.state as string;

      mockFetchSequence([
        {
          body: {
            access_token: 'linuxdo-access-token',
            token_type: 'Bearer',
            scope: 'read',
            refresh_token: 'linuxdo-refresh-token',
            expires_in: 3600,
          },
        },
        {
          body: {
            id: 24680,
            username: 'linuxdo_user',
            name: 'LinuxDO User',
            avatar_url: 'https://cdn.example.test/linuxdo-user.png',
            email: 'linuxdo@test.local',
            trust_level: 3,
          },
        },
      ]);

      const callbackResponse = await app.inject({
        method: 'GET',
        url: `/api/oauth/linuxdo?code=oauth-code&state=${state}`,
        cookies: {
          nodew_oauth_state: stateCookie!,
        },
      });

      expect(callbackResponse.statusCode).toBe(200);
      expect(callbackResponse.json()).toMatchObject({
        success: true,
        action: 'login',
        redirectTo: '/console',
        user: {
          email: 'linuxdo@test.local',
          username: 'linuxdo_user',
        },
      });

      const binding = await prisma.userOAuthBinding.findFirst({
        where: {
          provider: 'linuxdo',
          providerUserId: '24680',
        },
        select: {
          email: true,
          displayName: true,
          refreshToken: true,
        },
      });

      expect(binding).toMatchObject({
        email: 'linuxdo@test.local',
        displayName: 'LinuxDO User',
        refreshToken: 'linuxdo-refresh-token',
      });
    } finally {
      restoreEnv();
      await closeTestApp(app);
    }
  });
});

describe('oauth oidc integration', () => {
  it('creates an oauth state cookie and authorize url for oidc', async () => {
    const restoreEnv = withOIDCOAuthEnv();
    const app = await createTestApp();

    try {
      const response = await app.inject({
        method: 'GET',
        url: '/api/oauth/state?provider=oidc&redirectTo=/console',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        success: true,
        data: {
          state: expect.any(String),
        },
      });
      expect(response.json().data.authorizeUrl).toContain('https://id.example.test/oauth2/authorize');
      expect(response.json().data.authorizeUrl).toContain('client_id=oidc-client-id');
      expect(response.json().data.authorizeUrl).toContain('scope=openid+profile+email');
      expect(response.json().data.authorizeUrl).toContain('response_type=code');
      expect(response.json().data.authorizeUrl).toContain(encodeURIComponent('http://127.0.0.1:3000/oauth/oidc'));
      expect(extractCookieValue(response, 'nodew_oauth_state')).toBeTruthy();
    } finally {
      restoreEnv();
      await closeTestApp(app);
    }
  });

  it('creates a user session from the oidc callback when registration is enabled', async () => {
    const restoreEnv = withOIDCOAuthEnv();
    await enableRegistration();
    const app = await createTestApp();

    try {
      const stateResponse = await app.inject({
        method: 'GET',
        url: '/api/oauth/state?provider=oidc&redirectTo=/console',
      });
      const stateCookie = extractCookieValue(stateResponse, 'nodew_oauth_state');
      const state = stateResponse.json().data.state as string;

      mockFetchSequence([
        {
          body: {
            access_token: 'oidc-access-token',
            token_type: 'Bearer',
            scope: 'openid profile email',
            refresh_token: 'oidc-refresh-token',
            expires_in: 3600,
            id_token: 'oidc-id-token',
          },
        },
        {
          body: {
            sub: 'oidc-subject-1',
            preferred_username: 'oidc_user',
            name: 'OIDC User',
            email: 'oidc@test.local',
            picture: 'https://cdn.example.test/oidc-user.png',
            email_verified: true,
          },
        },
      ]);

      const callbackResponse = await app.inject({
        method: 'GET',
        url: `/api/oauth/oidc?code=oauth-code&state=${state}`,
        cookies: {
          nodew_oauth_state: stateCookie!,
        },
      });

      expect(callbackResponse.statusCode).toBe(200);
      expect(callbackResponse.json()).toMatchObject({
        success: true,
        action: 'login',
        redirectTo: '/console',
        user: {
          email: 'oidc@test.local',
          username: 'oidc_user',
        },
      });
      expect(extractCookieValue(callbackResponse, 'nodew_session')).toBeTruthy();

      const storedUser = await prisma.user.findUnique({
        where: { email: 'oidc@test.local' },
        select: {
          emailVerifiedAt: true,
        },
      });

      expect(storedUser?.emailVerifiedAt).toBeTruthy();

      const binding = await prisma.userOAuthBinding.findFirst({
        where: {
          provider: 'oidc',
          providerUserId: 'oidc-subject-1',
        },
        select: {
          email: true,
          displayName: true,
          refreshToken: true,
          avatarUrl: true,
        },
      });

      expect(binding).toMatchObject({
        email: 'oidc@test.local',
        displayName: 'OIDC User',
        refreshToken: 'oidc-refresh-token',
        avatarUrl: 'https://cdn.example.test/oidc-user.png',
      });
    } finally {
      restoreEnv();
      await closeTestApp(app);
    }
  });
});
