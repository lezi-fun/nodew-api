import { randomBytes } from 'node:crypto';

import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

export const oauthStateCookieName = 'nodew_oauth_state';
export const oauthStateTtlMs = 10 * 60 * 1000;

const oauthStateSchema = z.object({
  provider: z.string().min(1).max(64),
  mode: z.enum(['login', 'bind']).default('login'),
  state: z.string().min(1),
  redirectTo: z.string().min(1).optional(),
  userId: z.string().min(1).optional(),
  issuedAt: z.number().int().nonnegative(),
});

export type OAuthProvider = 'github' | 'discord' | 'linuxdo';

export const oauthProviderSchema = z.enum(['github', 'discord', 'linuxdo']);

export const oauthCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  signed: true,
  maxAge: oauthStateTtlMs / 1000,
};

export const generateOAuthState = () => randomBytes(24).toString('hex');

export const setOAuthStateCookie = (
  reply: FastifyReply,
  payload: z.infer<typeof oauthStateSchema>,
) => {
  reply.setCookie(oauthStateCookieName, JSON.stringify(payload), oauthCookieOptions);
};

export const clearOAuthStateCookie = (reply: FastifyReply) => {
  reply.clearCookie(oauthStateCookieName, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    signed: true,
  });
};

export const readOAuthStateCookie = (request: FastifyRequest) => {
  const cookie = request.cookies[oauthStateCookieName];

  if (!cookie) {
    return null;
  }

  const unsigned = request.unsignCookie(cookie);

  if (!unsigned.valid) {
    return null;
  }

  try {
    const parsed = oauthStateSchema.parse(JSON.parse(unsigned.value));

    if (Date.now() - parsed.issuedAt > oauthStateTtlMs) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
};

export const getOAuthProviderConfig = (provider: OAuthProvider) => {
  if (provider === 'github') {
    return {
      clientId: process.env.GITHUB_OAUTH_CLIENT_ID?.trim() || '',
      clientSecret: process.env.GITHUB_OAUTH_CLIENT_SECRET?.trim() || '',
      authorizeUrl: 'https://github.com/login/oauth/authorize',
      scope: 'read:user user:email',
    };
  }

  if (provider === 'discord') {
    return {
      clientId: process.env.DISCORD_OAUTH_CLIENT_ID?.trim() || '',
      clientSecret: process.env.DISCORD_OAUTH_CLIENT_SECRET?.trim() || '',
      authorizeUrl: 'https://discord.com/oauth2/authorize',
      scope: 'identify email',
    };
  }

  if (provider === 'linuxdo') {
    return {
      clientId: process.env.LINUXDO_OAUTH_CLIENT_ID?.trim() || '',
      clientSecret: process.env.LINUXDO_OAUTH_CLIENT_SECRET?.trim() || '',
      authorizeUrl: 'https://connect.linux.do/oauth2/authorize',
      scope: 'read',
    };
  }

  return null;
};
