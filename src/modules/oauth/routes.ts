import { randomBytes } from 'node:crypto';

import type { Prisma } from '@prisma/client';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { generateAccessToken, hashPassword } from '../../lib/crypto.js';
import {
  clearOAuthStateCookie,
  generateOAuthState,
  getOAuthProviderConfig,
  oauthProviderSchema,
  readOAuthStateCookie,
  setOAuthStateCookie,
  type OAuthProvider,
} from '../../lib/oauth.js';
import { clearSecureVerificationCookie } from '../../lib/passkey.js';
import { prisma } from '../../lib/prisma.js';
import { setSessionCookie } from '../../plugins/auth.js';
import { ensureRegistrationAllowed, ensureUserIdentityAvailable } from '../auth/registration.js';
import { setTwoFALoginChallengeCookie } from '../auth/twofa-login-challenge.js';

const oauthStateQuerySchema = z.object({
  provider: oauthProviderSchema,
  mode: z.enum(['login', 'bind']).optional(),
  redirectTo: z.string().trim().min(1).max(2048).optional(),
});

const oauthCallbackParamsSchema = z.object({
  provider: oauthProviderSchema,
});

const oauthCallbackQuerySchema = z.object({
  code: z.string().trim().min(1).max(2048).optional(),
  state: z.string().trim().min(1).max(2048).optional(),
  error: z.string().trim().min(1).max(256).optional(),
  error_description: z.string().trim().min(1).max(2048).optional(),
});

type GitHubTokenResponse = {
  access_token?: string;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
};

type GitHubUserResponse = {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string | null;
  email: string | null;
};

type GitHubEmailResponse = {
  email: string;
  verified: boolean;
  primary: boolean;
  visibility?: string | null;
};

const toOAuthMetadata = (metadata: Record<string, string | number | boolean | null>): Prisma.InputJsonObject => metadata;

const buildAppBaseUrl = () => (process.env.APP_BASE_URL ?? '').trim();

const isSafeRedirectTo = (value: string) => {
  if (!value.startsWith('/')) {
    return false;
  }

  if (value.startsWith('//')) {
    return false;
  }

  if (value.includes('://')) {
    return false;
  }

  return true;
};

const resolveOAuthRedirectUri = (provider: OAuthProvider) => {
  const appBaseUrl = buildAppBaseUrl();

  if (!appBaseUrl) {
    throw new Error('APP_BASE_URL is required for OAuth');
  }

  const url = new URL(appBaseUrl);
  url.pathname = `/oauth/${provider}`;
  url.search = '';
  url.hash = '';
  return url.toString();
};

const buildAuthorizeUrl = (provider: OAuthProvider, state: string) => {
  const config = getOAuthProviderConfig(provider);

  if (!config || !config.clientId || !config.clientSecret) {
    return null;
  }

  const redirectUri = resolveOAuthRedirectUri(provider);
  const url = new URL(config.authorizeUrl);
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', config.scope);
  url.searchParams.set('state', state);
  return url.toString();
};

const sanitizeUsername = (value: string) => value.trim().replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 32);

const pickAvailableUsername = async (candidate: string) => {
  const sanitized = sanitizeUsername(candidate);

  const base = sanitized.length >= 3 ? sanitized : `user_${randomBytes(4).toString('hex')}`;

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const suffix = attempt === 0 ? '' : `_${randomBytes(2).toString('hex')}`;
    const username = `${base}${suffix}`.slice(0, 32);

    const exists = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });

    if (!exists) {
      return username;
    }
  }

  return `user_${randomBytes(6).toString('hex')}`.slice(0, 32);
};

const pickGitHubEmail = (emails: GitHubEmailResponse[] | null, userEmail: string | null) => {
  const safeEmails = Array.isArray(emails) ? emails : [];
  const primary = safeEmails.find((entry) => entry.primary && entry.verified)?.email;
  const verified = safeEmails.find((entry) => entry.verified)?.email;
  return (primary || verified || userEmail || '').trim() || null;
};

const fetchGitHubToken = async (args: {
  code: string;
  state: string;
  redirectUri: string;
}) => {
  const config = getOAuthProviderConfig('github');

  if (!config || !config.clientId || !config.clientSecret) {
    throw new Error('GitHub OAuth is not configured');
  }

  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code: args.code,
      redirect_uri: args.redirectUri,
      state: args.state,
    }).toString(),
  });

  const json = await response.json().catch(() => ({})) as GitHubTokenResponse;

  if (!response.ok || json.error || !json.access_token) {
    const message = json.error_description || json.error || 'OAuth token exchange failed';
    throw new Error(message);
  }

  return json;
};

const fetchGitHubUserInfo = async (accessToken: string) => {
  const headers = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${accessToken}`,
  };

  const userResponse = await fetch('https://api.github.com/user', { headers });
  const userJson = await userResponse.json().catch(() => null) as GitHubUserResponse | null;

  if (!userResponse.ok || !userJson) {
    throw new Error('Failed to fetch GitHub user info');
  }

  const emailsResponse = await fetch('https://api.github.com/user/emails', { headers });
  const emailsJson = await emailsResponse.json().catch(() => null) as GitHubEmailResponse[] | null;

  const email = pickGitHubEmail(emailsJson, userJson.email);

  return {
    providerUserId: String(userJson.id),
    username: userJson.login,
    displayName: userJson.name || userJson.login,
    avatarUrl: userJson.avatar_url,
    email,
    emailVerified: Array.isArray(emailsJson)
      ? Boolean(emailsJson.find((entry) => entry.email === email)?.verified)
      : false,
    metadata: toOAuthMetadata({
      id: userJson.id,
      login: userJson.login,
    }),
  };
};

const createSession = async (userId: string) => {
  const sessionToken = generateAccessToken();

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      accessToken: sessionToken,
      lastLoginAt: new Date(),
    },
    select: {
      id: true,
      email: true,
      username: true,
      displayName: true,
      emailVerifiedAt: true,
      role: true,
      status: true,
      lastLoginAt: true,
    },
  });

  return {
    sessionToken,
    user,
  };
};

const oauthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/oauth/state', async (request, reply) => {
    const query = oauthStateQuerySchema.parse(request.query);
    const mode = query.mode ?? (request.currentUser ? 'bind' : 'login');

    if (mode === 'bind' && !request.currentUser) {
      throw app.httpErrors.unauthorized('Authentication required');
    }

    if (query.redirectTo && !isSafeRedirectTo(query.redirectTo)) {
      throw app.httpErrors.badRequest('Invalid redirect target');
    }

    const state = generateOAuthState();
    let authorizeUrl: string | null;

    try {
      authorizeUrl = buildAuthorizeUrl(query.provider, state);
    } catch (error) {
      if (error instanceof Error && error.message === 'APP_BASE_URL is required for OAuth') {
        throw app.httpErrors.badRequest(error.message);
      }

      throw error;
    }

    if (!authorizeUrl) {
      throw app.httpErrors.badRequest('OAuth provider is not configured');
    }

    setOAuthStateCookie(reply, {
      provider: query.provider,
      mode,
      state,
      redirectTo: query.redirectTo,
      userId: mode === 'bind' ? request.currentUser?.id : undefined,
      issuedAt: Date.now(),
    });

    return {
      success: true,
      data: {
        state,
        authorizeUrl,
      },
    };
  });

  app.get('/oauth/:provider', async (request, reply) => {
    const params = oauthCallbackParamsSchema.parse(request.params);
    const query = oauthCallbackQuerySchema.parse(request.query);

    const statePayload = readOAuthStateCookie(request);

    if (!statePayload || statePayload.provider !== params.provider || statePayload.state !== query.state) {
      clearOAuthStateCookie(reply);
      throw app.httpErrors.forbidden('OAuth state is invalid or expired');
    }

    clearOAuthStateCookie(reply);

    if (query.error) {
      throw app.httpErrors.badRequest(query.error_description || query.error);
    }

    if (!query.code) {
      throw app.httpErrors.badRequest('OAuth code is required');
    }

    const currentUser = request.currentUser;
    const action = statePayload.mode;

    if (action === 'bind' && (!currentUser || currentUser.id !== statePayload.userId)) {
      throw app.httpErrors.forbidden('OAuth binding session is invalid or expired');
    }

    if (params.provider === 'github') {
      let redirectUri: string;

      try {
        redirectUri = resolveOAuthRedirectUri('github');
      } catch (error) {
        if (error instanceof Error && error.message === 'APP_BASE_URL is required for OAuth') {
          throw app.httpErrors.badRequest(error.message);
        }

        throw error;
      }

      const token = await fetchGitHubToken({ code: query.code, state: statePayload.state, redirectUri });
      const oauthUser = await fetchGitHubUserInfo(token.access_token!);

      if (!oauthUser.email) {
        throw app.httpErrors.badRequest('OAuth account does not provide an email address');
      }

      if (action === 'bind') {
        if (!currentUser) {
          throw app.httpErrors.forbidden('OAuth binding session is invalid or expired');
        }

        const userId = currentUser.id;

        const existingByProviderId = await prisma.userOAuthBinding.findFirst({
          where: {
            provider: 'github',
            providerUserId: oauthUser.providerUserId,
          },
          select: { id: true, userId: true },
        });

        if (existingByProviderId && existingByProviderId.userId !== userId) {
          throw app.httpErrors.conflict('This OAuth account is already bound to another user');
        }

        const existingForUser = await prisma.userOAuthBinding.findFirst({
          where: {
            userId,
            provider: 'github',
          },
          select: { id: true },
        });

        if (existingForUser) {
          await prisma.userOAuthBinding.update({
            where: { id: existingForUser.id },
            data: {
              providerUserId: oauthUser.providerUserId,
              email: oauthUser.email,
              displayName: oauthUser.displayName,
              avatarUrl: oauthUser.avatarUrl,
              tokenType: token.token_type ?? null,
              scope: token.scope ?? null,
              accessToken: token.access_token ?? null,
              metadata: oauthUser.metadata,
              deletedAt: null,
            },
          });
        } else {
          await prisma.userOAuthBinding.create({
            data: {
              userId,
              provider: 'github',
              providerUserId: oauthUser.providerUserId,
              email: oauthUser.email,
              displayName: oauthUser.displayName,
              avatarUrl: oauthUser.avatarUrl,
              tokenType: token.token_type ?? null,
              scope: token.scope ?? null,
              accessToken: token.access_token ?? null,
              metadata: oauthUser.metadata,
            },
          });
        }

        return {
          success: true,
          action: 'bind',
          redirectTo: statePayload.redirectTo ?? null,
        };
      }

      const existingBinding = await prisma.userOAuthBinding.findFirst({
        where: {
          provider: 'github',
          providerUserId: oauthUser.providerUserId,
        },
        select: {
          userId: true,
          user: {
            select: {
              id: true,
              email: true,
              status: true,
            },
          },
        },
      });

      let userId: string;

      if (existingBinding) {
        if (existingBinding.user.status !== 'ACTIVE') {
          throw app.httpErrors.forbidden('User is disabled');
        }

        userId = existingBinding.userId;
      } else {
        try {
          await ensureRegistrationAllowed();
        } catch (error) {
          if (error instanceof Error && error.message === 'System is not initialized') {
            throw app.httpErrors.conflict('System is not initialized');
          }

          if (error instanceof Error && error.message === 'User registration is disabled') {
            throw app.httpErrors.forbidden('User registration is disabled');
          }

          throw error;
        }

        const usernameCandidate = oauthUser.username || `github_${oauthUser.providerUserId}`;
        const username = await pickAvailableUsername(usernameCandidate);

        try {
          await ensureUserIdentityAvailable(oauthUser.email, username);
        } catch (error) {
          if (error instanceof Error && error.message === 'User already exists') {
            throw app.httpErrors.conflict('User already exists');
          }

          throw error;
        }

        const created = await prisma.$transaction(async (tx) => {
          const user = await tx.user.create({
            data: {
              email: oauthUser.email!,
              username,
              passwordHash: hashPassword(generateAccessToken()),
              displayName: oauthUser.displayName,
              emailVerifiedAt: oauthUser.emailVerified ? new Date() : null,
              role: 'USER',
              status: 'ACTIVE',
            },
            select: { id: true },
          });

          await tx.userOAuthBinding.create({
            data: {
              userId: user.id,
              provider: 'github',
              providerUserId: oauthUser.providerUserId,
              email: oauthUser.email,
              displayName: oauthUser.displayName,
              avatarUrl: oauthUser.avatarUrl,
              tokenType: token.token_type ?? null,
              scope: token.scope ?? null,
              accessToken: token.access_token ?? null,
              metadata: oauthUser.metadata,
            },
          });

          return user;
        });

        userId = created.id;
      }

      const twoFA = await prisma.twoFA.findUnique({
        where: { userId },
        select: { isEnabled: true },
      });

      if (twoFA?.isEnabled) {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { email: true },
        });

        setTwoFALoginChallengeCookie(reply, userId);

        return {
          success: true,
          requiresTwoFA: true,
          email: user?.email ?? null,
          redirectTo: statePayload.redirectTo ?? null,
        };
      }

      const session = await createSession(userId);

      setSessionCookie(reply, session.sessionToken);
      clearSecureVerificationCookie(reply);

      return {
        success: true,
        action: 'login',
        user: session.user,
        redirectTo: statePayload.redirectTo ?? null,
      };
    }

    throw app.httpErrors.badRequest('OAuth provider is not supported');
  });
};

export default oauthRoutes;
