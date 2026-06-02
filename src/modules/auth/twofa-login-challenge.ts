import type { FastifyReply } from 'fastify';
import { z } from 'zod';

export const twoFALoginChallengeCookieName = 'nodew_login_2fa';
export const twoFALoginChallengeTtlMs = 5 * 60 * 1000;

export const twoFALoginChallengeSchema = z.object({
  userId: z.string().min(1),
  issuedAt: z.number().int().nonnegative(),
});

export const setTwoFALoginChallengeCookie = (reply: FastifyReply, userId: string) => {
  reply.setCookie(twoFALoginChallengeCookieName, JSON.stringify({
    userId,
    issuedAt: Date.now(),
  }), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    signed: true,
    maxAge: Math.floor(twoFALoginChallengeTtlMs / 1000),
  });
};

export const clearTwoFALoginChallengeCookie = (reply: FastifyReply) => {
  reply.clearCookie(twoFALoginChallengeCookieName, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    signed: true,
  });
};

