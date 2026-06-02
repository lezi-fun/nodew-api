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
});
