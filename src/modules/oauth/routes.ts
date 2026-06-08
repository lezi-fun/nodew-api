import { randomBytes } from 'node:crypto';

import type { Prisma } from '@prisma/client';
import type { FastifyInstance, FastifyPluginAsync, FastifyReply } from 'fastify';
import { z } from 'zod';

import { generateAccessToken, hashPassword } from '../../lib/crypto.js';
import { getEffectiveOAuthProviderConfig } from '../../lib/oauth-config.js';
import {
  clearOAuthStateCookie,
  generateOAuthState,
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

type DiscordTokenResponse = {
  access_token?: string;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
};

type DiscordUserResponse = {
  id: string;
  username: string;
  global_name: string | null;
  avatar: string | null;
  email: string | null;
  verified: boolean | null;
};

type LinuxDOTokenResponse = {
  access_token?: string;
  token_type?: string;
  scope?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

type LinuxDOUserResponse = {
  id: number | string;
  username: string;
  name?: string | null;
  avatar_url?: string | null;
  email?: string | null;
  trust_level?: number | null;
};

type OIDCTokenResponse = {
  access_token?: string;
  id_token?: string;
  token_type?: string;
  scope?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

type OIDCUserResponse = {
  sub?: string;
  preferred_username?: string | null;
  name?: string | null;
  email?: string | null;
  picture?: string | null;
  email_verified?: boolean | null;
};

type OAuthTokenResult = {
  access_token?: string;
  token_type?: string;
  scope?: string;
  refresh_token?: string;
  expires_in?: number;
};

type OAuthUserProfile = {
  providerUserId: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  email: string | null;
  emailVerified: boolean;
  metadata: Prisma.InputJsonObject;
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

const buildAuthorizeUrl = async (provider: OAuthProvider, state: string) => {
  const config = await getEffectiveOAuthProviderConfig(provider);

  if (!config || !config.clientId || !config.clientSecret || !config.authorizeUrl) {
    return null;
  }

  const redirectUri = resolveOAuthRedirectUri(provider);
  const url = new URL(config.authorizeUrl);
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', config.scope);
  url.searchParams.set('state', state);
  if (provider === 'oidc') {
    url.searchParams.set('response_type', 'code');
  }
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
  const config = await getEffectiveOAuthProviderConfig('github');

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

const fetchDiscordToken = async (args: {
  code: string;
  redirectUri: string;
}) => {
  const config = await getEffectiveOAuthProviderConfig('discord');

  if (!config || !config.clientId || !config.clientSecret) {
    throw new Error('Discord OAuth is not configured');
  }

  const response = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code: args.code,
      grant_type: 'authorization_code',
      redirect_uri: args.redirectUri,
    }).toString(),
  });

  const json = await response.json().catch(() => ({})) as DiscordTokenResponse;

  if (!response.ok || json.error || !json.access_token) {
    const message = json.error_description || json.error || 'OAuth token exchange failed';
    throw new Error(message);
  }

  return json;
};

const fetchDiscordUserInfo = async (accessToken: string) => {
  const response = await fetch('https://discord.com/api/users/@me', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const userJson = await response.json().catch(() => null) as DiscordUserResponse | null;

  if (!response.ok || !userJson) {
    throw new Error('Failed to fetch Discord user info');
  }

  const avatarHash = userJson.avatar;
  const avatarUrl = avatarHash
    ? `https://cdn.discordapp.com/avatars/${userJson.id}/${avatarHash}.png`
    : `https://cdn.discordapp.com/embed/avatars/${BigInt(userJson.id) % 6n}.png`;

  return {
    providerUserId: userJson.id,
    username: userJson.username,
    displayName: userJson.global_name || userJson.username,
    avatarUrl,
    email: userJson.email?.trim() || null,
    emailVerified: userJson.verified ?? false,
    metadata: toOAuthMetadata({
      id: userJson.id,
      username: userJson.username,
    }),
  };
};

const fetchLinuxDOToken = async (args: {
  code: string;
  redirectUri: string;
}) => {
  const config = await getEffectiveOAuthProviderConfig('linuxdo');

  if (!config || !config.clientId || !config.clientSecret) {
    throw new Error('LinuxDO OAuth is not configured');
  }

  const response = await fetch('https://connect.linux.do/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code: args.code,
      grant_type: 'authorization_code',
      redirect_uri: args.redirectUri,
    }).toString(),
  });

  const json = await response.json().catch(() => ({})) as LinuxDOTokenResponse;

  if (!response.ok || json.error || !json.access_token) {
    const message = json.error_description || json.error || 'OAuth token exchange failed';
    throw new Error(message);
  }

  return json;
};

const fetchLinuxDOUserInfo = async (accessToken: string) => {
  const response = await fetch('https://connect.linux.do/api/user', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  const userJson = await response.json().catch(() => null) as LinuxDOUserResponse | null;

  if (!response.ok || !userJson) {
    throw new Error('Failed to fetch LinuxDO user info');
  }

  return {
    providerUserId: String(userJson.id),
    username: userJson.username,
    displayName: userJson.name?.trim() || userJson.username,
    avatarUrl: userJson.avatar_url?.trim() || null,
    email: userJson.email?.trim() || null,
    emailVerified: Boolean(userJson.email?.trim()),
    metadata: toOAuthMetadata({
      id: String(userJson.id),
      username: userJson.username,
      trustLevel: userJson.trust_level ?? null,
    }),
  };
};

const fetchOIDCToken = async (args: {
  code: string;
  redirectUri: string;
}) => {
  const config = await getEffectiveOAuthProviderConfig('oidc');

  if (!config || !config.clientId || !config.clientSecret || !config.tokenUrl) {
    throw new Error('OIDC OAuth is not configured');
  }

  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code: args.code,
      grant_type: 'authorization_code',
      redirect_uri: args.redirectUri,
    }).toString(),
  });

  const json = await response.json().catch(() => ({})) as OIDCTokenResponse;

  if (!response.ok || json.error || !json.access_token) {
    const message = json.error_description || json.error || 'OAuth token exchange failed';
    throw new Error(message);
  }

  return json;
};

const fetchOIDCUserInfo = async (accessToken: string) => {
  const config = await getEffectiveOAuthProviderConfig('oidc');

  if (!config?.userInfoUrl) {
    throw new Error('OIDC OAuth is not configured');
  }

  const response = await fetch(config.userInfoUrl, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const userJson = await response.json().catch(() => null) as OIDCUserResponse | null;

  if (!response.ok || !userJson) {
    throw new Error('Failed to fetch OIDC user info');
  }

  const providerUserId = userJson.sub?.trim();
  const email = userJson.email?.trim() || null;

  if (!providerUserId || !email) {
    throw new Error('OIDC account does not provide required user info');
  }

  const preferredUsername = userJson.preferred_username?.trim() || null;
  const displayName = userJson.name?.trim() || preferredUsername || email;

  return {
    providerUserId,
    username: preferredUsername || email.split('@')[0] || null,
    displayName,
    avatarUrl: userJson.picture?.trim() || null,
    email,
    emailVerified: userJson.email_verified === true,
    metadata: toOAuthMetadata({
      sub: providerUserId,
      preferredUsername,
      emailVerified: userJson.email_verified ?? null,
    }),
  };
};

const fetchOAuthToken = async (provider: OAuthProvider, args: {
  code: string;
  state: string;
  redirectUri: string;
}): Promise<OAuthTokenResult> => {
  if (provider === 'github') {
    return fetchGitHubToken(args);
  }

  if (provider === 'discord') {
    return fetchDiscordToken(args);
  }

  if (provider === 'linuxdo') {
    return fetchLinuxDOToken(args);
  }

  if (provider === 'oidc') {
    return fetchOIDCToken(args);
  }

  throw new Error('OAuth provider is not supported');
};

const fetchOAuthUserInfo = async (provider: OAuthProvider, accessToken: string): Promise<OAuthUserProfile> => {
  if (provider === 'github') {
    return fetchGitHubUserInfo(accessToken);
  }

  if (provider === 'discord') {
    return fetchDiscordUserInfo(accessToken);
  }

  if (provider === 'linuxdo') {
    return fetchLinuxDOUserInfo(accessToken);
  }

  if (provider === 'oidc') {
    return fetchOIDCUserInfo(accessToken);
  }

  throw new Error('OAuth provider is not supported');
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

const resolveOAuthRedirectUriOrHttpError = (app: FastifyInstance, provider: OAuthProvider) => {
  try {
    return resolveOAuthRedirectUri(provider);
  } catch (error) {
    if (error instanceof Error && error.message === 'APP_BASE_URL is required for OAuth') {
      throw app.httpErrors.badRequest(error.message);
    }

    throw error;
  }
};

const buildOAuthBindingData = (oauthUser: OAuthUserProfile, token: OAuthTokenResult) => ({
  providerUserId: oauthUser.providerUserId,
  email: oauthUser.email,
  displayName: oauthUser.displayName,
  avatarUrl: oauthUser.avatarUrl,
  tokenType: token.token_type ?? null,
  scope: token.scope ?? null,
  accessToken: token.access_token ?? null,
  refreshToken: token.refresh_token ?? null,
  expiresAt: typeof token.expires_in === 'number' ? new Date(Date.now() + token.expires_in * 1000) : null,
  metadata: oauthUser.metadata,
});

const bindOAuthAccount = async (args: {
  provider: OAuthProvider;
  userId: string;
  oauthUser: OAuthUserProfile;
  token: OAuthTokenResult;
}) => {
  const existingByProviderId = await prisma.userOAuthBinding.findFirst({
    where: {
      provider: args.provider,
      providerUserId: args.oauthUser.providerUserId,
    },
    select: { id: true, userId: true },
  });

  if (existingByProviderId && existingByProviderId.userId !== args.userId) {
    throw new Error('This OAuth account is already bound to another user');
  }

  const existingForUser = await prisma.userOAuthBinding.findFirst({
    where: {
      userId: args.userId,
      provider: args.provider,
    },
    select: { id: true },
  });

  const bindingData = buildOAuthBindingData(args.oauthUser, args.token);

  if (existingForUser) {
    await prisma.userOAuthBinding.update({
      where: { id: existingForUser.id },
      data: {
        ...bindingData,
        deletedAt: null,
      },
    });
    return;
  }

  await prisma.userOAuthBinding.create({
    data: {
      userId: args.userId,
      provider: args.provider,
      ...bindingData,
    },
  });
};

const findOrCreateOAuthLoginUser = async (app: FastifyInstance, args: {
  provider: OAuthProvider;
  oauthUser: OAuthUserProfile;
  token: OAuthTokenResult;
}) => {
  const existingBinding = await prisma.userOAuthBinding.findFirst({
    where: {
      provider: args.provider,
      providerUserId: args.oauthUser.providerUserId,
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

  if (existingBinding) {
    if (existingBinding.user.status !== 'ACTIVE') {
      throw app.httpErrors.forbidden('User is disabled');
    }

    return existingBinding.userId;
  }

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

  const usernameCandidate = args.oauthUser.username || `${args.provider}_${args.oauthUser.providerUserId}`;
  const username = await pickAvailableUsername(usernameCandidate);

  try {
    await ensureUserIdentityAvailable(args.oauthUser.email!, username);
  } catch (error) {
    if (error instanceof Error && error.message === 'User already exists') {
      throw app.httpErrors.conflict('User already exists');
    }

    throw error;
  }

  const created = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: args.oauthUser.email!,
        username,
        passwordHash: hashPassword(generateAccessToken()),
        displayName: args.oauthUser.displayName,
        emailVerifiedAt: args.oauthUser.emailVerified ? new Date() : null,
        role: 'USER',
        status: 'ACTIVE',
      },
      select: { id: true },
    });

    await tx.userOAuthBinding.create({
      data: {
        userId: user.id,
        provider: args.provider,
        ...buildOAuthBindingData(args.oauthUser, args.token),
      },
    });

    return user;
  });

  return created.id;
};

const completeOAuthLogin = async (args: {
  reply: FastifyReply;
  userId: string;
  redirectTo?: string;
}) => {
  const twoFA = await prisma.twoFA.findUnique({
    where: { userId: args.userId },
    select: { isEnabled: true },
  });

  if (twoFA?.isEnabled) {
    const user = await prisma.user.findUnique({
      where: { id: args.userId },
      select: { email: true },
    });

    setTwoFALoginChallengeCookie(args.reply, args.userId);

    return {
      success: true,
      requiresTwoFA: true,
      email: user?.email ?? null,
      redirectTo: args.redirectTo ?? null,
    };
  }

  const session = await createSession(args.userId);

  setSessionCookie(args.reply, session.sessionToken);
  clearSecureVerificationCookie(args.reply);

  return {
    success: true,
    action: 'login',
    user: session.user,
    redirectTo: args.redirectTo ?? null,
  };
};

const handleOAuthCallback = async (app: FastifyInstance, args: {
  reply: FastifyReply;
  provider: OAuthProvider;
  code: string;
  state: string;
  action: 'login' | 'bind';
  redirectTo?: string;
  currentUserId?: string;
}) => {
  const redirectUri = resolveOAuthRedirectUriOrHttpError(app, args.provider);
  const token = await fetchOAuthToken(args.provider, {
    code: args.code,
    state: args.state,
    redirectUri,
  });
  const accessToken = token.access_token;

  if (!accessToken) {
    throw app.httpErrors.badRequest('OAuth token exchange failed');
  }

  let oauthUser: OAuthUserProfile;

  try {
    oauthUser = await fetchOAuthUserInfo(args.provider, accessToken);
  } catch (error) {
    if (error instanceof Error && error.message === 'OIDC account does not provide required user info') {
      throw app.httpErrors.badRequest(error.message);
    }

    throw error;
  }

  if (!oauthUser.email) {
    throw app.httpErrors.badRequest('OAuth account does not provide an email address');
  }

  if (args.action === 'bind') {
    if (!args.currentUserId) {
      throw app.httpErrors.forbidden('OAuth binding session is invalid or expired');
    }

    try {
      await bindOAuthAccount({
        provider: args.provider,
        userId: args.currentUserId,
        oauthUser,
        token,
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'This OAuth account is already bound to another user') {
        throw app.httpErrors.conflict(error.message);
      }

      throw error;
    }

    return {
      success: true,
      action: 'bind',
      redirectTo: args.redirectTo ?? null,
    };
  }

  const userId = await findOrCreateOAuthLoginUser(app, {
    provider: args.provider,
    oauthUser,
    token,
  });

  return completeOAuthLogin({
    reply: args.reply,
    userId,
    redirectTo: args.redirectTo,
  });
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
      authorizeUrl = await buildAuthorizeUrl(query.provider, state);
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

    if (params.provider === 'discord') {
      let redirectUri: string;

      try {
        redirectUri = resolveOAuthRedirectUri('discord');
      } catch (error) {
        if (error instanceof Error && error.message === 'APP_BASE_URL is required for OAuth') {
          throw app.httpErrors.badRequest(error.message);
        }

        throw error;
      }

      const token = await fetchDiscordToken({ code: query.code, redirectUri });
      const oauthUser = await fetchDiscordUserInfo(token.access_token!);

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
            provider: 'discord',
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
            provider: 'discord',
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
              provider: 'discord',
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
          provider: 'discord',
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

        const usernameCandidate = oauthUser.username || `discord_${oauthUser.providerUserId}`;
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
              provider: 'discord',
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


    if (params.provider === 'linuxdo') {
      let redirectUri: string;

      try {
        redirectUri = resolveOAuthRedirectUri('linuxdo');
      } catch (error) {
        if (error instanceof Error && error.message === 'APP_BASE_URL is required for OAuth') {
          throw app.httpErrors.badRequest(error.message);
        }

        throw error;
      }

      const token = await fetchLinuxDOToken({ code: query.code, redirectUri });
      const oauthUser = await fetchLinuxDOUserInfo(token.access_token!);

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
            provider: 'linuxdo',
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
            provider: 'linuxdo',
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
              refreshToken: token.refresh_token ?? null,
              expiresAt: typeof token.expires_in === 'number' ? new Date(Date.now() + token.expires_in * 1000) : null,
              metadata: oauthUser.metadata,
              deletedAt: null,
            },
          });
        } else {
          await prisma.userOAuthBinding.create({
            data: {
              userId,
              provider: 'linuxdo',
              providerUserId: oauthUser.providerUserId,
              email: oauthUser.email,
              displayName: oauthUser.displayName,
              avatarUrl: oauthUser.avatarUrl,
              tokenType: token.token_type ?? null,
              scope: token.scope ?? null,
              accessToken: token.access_token ?? null,
              refreshToken: token.refresh_token ?? null,
              expiresAt: typeof token.expires_in === 'number' ? new Date(Date.now() + token.expires_in * 1000) : null,
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
          provider: 'linuxdo',
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

        const usernameCandidate = oauthUser.username || `linuxdo_${oauthUser.providerUserId}`;
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
              provider: 'linuxdo',
              providerUserId: oauthUser.providerUserId,
              email: oauthUser.email,
              displayName: oauthUser.displayName,
              avatarUrl: oauthUser.avatarUrl,
              tokenType: token.token_type ?? null,
              scope: token.scope ?? null,
              accessToken: token.access_token ?? null,
              refreshToken: token.refresh_token ?? null,
              expiresAt: typeof token.expires_in === 'number' ? new Date(Date.now() + token.expires_in * 1000) : null,
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

    if (params.provider === 'oidc') {
      return handleOAuthCallback(app, {
        reply,
        provider: 'oidc',
        code: query.code,
        state: statePayload.state,
        action,
        redirectTo: statePayload.redirectTo,
        currentUserId: currentUser?.id,
      });
    }

    throw app.httpErrors.badRequest('OAuth provider is not supported');
  });
};

export default oauthRoutes;
