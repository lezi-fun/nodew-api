import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import {
  generateAccessToken,
  generateEmailVerificationToken,
  generatePasswordResetToken,
  getRedemptionCodePrefix,
  hashEmailVerificationToken,
  hashPassword,
  verifyPassword,
  verifyRedemptionCode,
} from '../../lib/crypto.js';
import {
  isValidBackupCodeFormat,
  normalizeBackupCode,
  validateTotpCode,
} from '../../lib/totp.js';
import {
  buildEmailVerificationMessage,
  buildPasswordResetMessage,
  buildRegistrationVerificationMessage,
  sendMailMessage,
} from '../../lib/mailer.js';
import { isMailDeliveryEnabled } from '../../lib/mail-config.js';
import { prisma } from '../../lib/prisma.js';
import { clearSessionCookie, setSessionCookie } from '../../plugins/auth.js';
import { canUseEmailVerificationToken, setEmailVerificationToken } from './email-verification.js';
import {
  canUsePendingRegistration,
  createPendingRegistration,
  deleteExpiredPendingRegistrations,
  deletePendingRegistration,
  getPendingRegistrationByEmail,
  getPendingRegistrationByToken,
} from './pending-registration.js';
import { setPasswordResetToken, updateUserPassword, canUsePasswordResetToken } from './password-reset.js';
import {
  ensureRegistrationAllowed,
  ensureUserIdentityAvailable,
  isRegistrationEmailVerificationRequired,
} from './registration.js';

const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

const registerBodySchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_-]+$/),
  password: z.string().min(8).max(128),
  displayName: z.string().min(1).max(64).optional(),
  verificationToken: z.string().trim().min(1).max(256).optional(),
  verificationCode: z.string().trim().min(1).max(32).optional(),
});

const registerVerificationRequestBodySchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_-]+$/),
  password: z.string().min(8).max(128),
  displayName: z.string().min(1).max(64).optional(),
});

const forgotPasswordBodySchema = z.object({
  email: z.string().email(),
});

const resetPasswordBodySchema = z.object({
  email: z.string().email(),
  token: z.string().min(1).max(256),
  password: z.string().min(8).max(128),
});

const verifyEmailBodySchema = z.object({
  token: z.string().trim().min(1).max(256),
});

const verifyRegistrationBodySchema = z.object({
  email: z.string().email().optional(),
  token: z.string().trim().min(1).max(256).optional(),
  code: z.string().trim().min(1).max(32).optional(),
}).refine((value) => Boolean(value.token || value.code), {
  message: 'Verification token or code is required',
});

const twoFALoginBodySchema = z.object({
  code: z.string().trim().min(1).max(32),
});

const redeemRedemptionBodySchema = z.object({
  code: z.string().trim().min(1).max(128),
});

const authUserSelect = {
  id: true,
  email: true,
  username: true,
  displayName: true,
  emailVerifiedAt: true,
  role: true,
  status: true,
  lastLoginAt: true,
} as const;

const loginUserSelect = {
  ...authUserSelect,
  passwordHash: true,
} as const;

const twoFASelect = {
  id: true,
  userId: true,
  secret: true,
  isEnabled: true,
  failedAttempts: true,
  lockedUntil: true,
  lastUsedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

const backupCodeSelect = {
  id: true,
  codeHash: true,
} as const;

const twoFALoginChallengeCookieName = 'nodew_login_2fa';
const twoFALoginChallengeTtlMs = 5 * 60 * 1000;

const twoFALoginChallengeSchema = z.object({
  userId: z.string().min(1),
  issuedAt: z.number().int().nonnegative(),
});

const serializeAuthUser = (user: {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  emailVerifiedAt: Date | null;
  role: 'USER' | 'ADMIN';
  status: 'ACTIVE' | 'DISABLED';
  lastLoginAt: Date | null;
}) => user;

const createSessionForUser = async (userId: string, client: Pick<typeof prisma, 'user'> = prisma) => {
  const sessionToken = generateAccessToken();

  return client.user.update({
    where: { id: userId },
    data: {
      accessToken: sessionToken,
      lastLoginAt: new Date(),
    },
    select: authUserSelect,
  }).then((user) => ({ user, sessionToken }));
};

const authRoutes: FastifyPluginAsync = async (app) => {
  app.post('/user/register', async (request, reply) => {
    const body = registerBodySchema.parse(request.body);
    const registrationEmailVerificationRequired = await isRegistrationEmailVerificationRequired();

    try {
      await ensureRegistrationAllowed();
      await ensureUserIdentityAvailable(body.email, body.username, {
        allowPendingRegistrationForSameEmail: registrationEmailVerificationRequired,
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'System is not initialized') {
        throw app.httpErrors.conflict('System is not initialized');
      }

      if (error instanceof Error && error.message === 'User registration is disabled') {
        throw app.httpErrors.forbidden('User registration is disabled');
      }

      if (error instanceof Error && error.message === 'User already exists') {
        throw app.httpErrors.conflict('User already exists');
      }

      throw error;
    }

    if (registrationEmailVerificationRequired) {
      const pendingRegistration = body.verificationToken
        ? await getPendingRegistrationByToken(body.verificationToken)
        : await getPendingRegistrationByEmail(body.email);

      const isVerified = canUsePendingRegistration(
        pendingRegistration,
        {
          token: body.verificationToken,
          code: body.verificationCode,
        },
      );

      if (!isVerified || !pendingRegistration) {
        throw app.httpErrors.badRequest('Registration verification token or code is invalid or expired');
      }

      if (pendingRegistration.email !== body.email || pendingRegistration.username !== body.username) {
        throw app.httpErrors.badRequest('Registration verification does not match the submitted account');
      }

      const user = await prisma.user.create({
        data: {
          email: pendingRegistration.email,
          username: pendingRegistration.username,
          passwordHash: pendingRegistration.passwordHash,
          displayName: pendingRegistration.displayName,
          emailVerifiedAt: new Date(),
          role: 'USER',
        },
        select: authUserSelect,
      });

      await deletePendingRegistration(pendingRegistration.id);

      return reply.code(201).send({
        user: serializeAuthUser(user),
      });
    }

    const user = await prisma.user.create({
      data: {
        email: body.email,
        username: body.username,
        passwordHash: hashPassword(body.password),
        displayName: body.displayName ?? body.username,
        role: 'USER',
      },
      select: authUserSelect,
    });

    return reply.code(201).send({
      user: serializeAuthUser(user),
    });
  });

  app.post('/user/register/verification', async (request, reply) => {
    const body = registerVerificationRequestBodySchema.parse(request.body);

    try {
      await ensureRegistrationAllowed();
      await ensureUserIdentityAvailable(body.email, body.username, {
        allowPendingRegistrationForSameEmail: true,
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'System is not initialized') {
        throw app.httpErrors.conflict('System is not initialized');
      }

      if (error instanceof Error && error.message === 'User registration is disabled') {
        throw app.httpErrors.forbidden('User registration is disabled');
      }

      if (error instanceof Error && error.message === 'User already exists') {
        throw app.httpErrors.conflict('User already exists');
      }

      throw error;
    }

    await deleteExpiredPendingRegistrations();

    if (process.env.NODE_ENV !== 'test' && !await isMailDeliveryEnabled()) {
      throw app.httpErrors.badRequest('Mail delivery is not enabled');
    }

    const { token, code } = await createPendingRegistration(body);

    if (process.env.NODE_ENV === 'test') {
      reply.header('x-registration-verification-token', token);
      reply.header('x-registration-verification-code', code);
    } else if (await isMailDeliveryEnabled()) {
      await sendMailMessage(await buildRegistrationVerificationMessage(body.email, token, code));
    } else {
      request.log.info({
        email: body.email,
        verificationPath: `/verify-email?token=${token}`,
        verificationCode: code,
      }, 'Registration verification generated');
    }

    return {
      success: true,
    };
  });

  app.post('/user/register/verify', async (request) => {
    const body = verifyRegistrationBodySchema.parse(request.body);
    const pendingRegistration = body.token
      ? await getPendingRegistrationByToken(body.token)
      : body.email
        ? await getPendingRegistrationByEmail(body.email)
        : null;

    if (!canUsePendingRegistration(pendingRegistration, { token: body.token, code: body.code }) || !pendingRegistration) {
      throw app.httpErrors.badRequest('Registration verification token or code is invalid or expired');
    }

    return {
      success: true,
      email: pendingRegistration.email,
      username: pendingRegistration.username,
      displayName: pendingRegistration.displayName,
    };
  });

  app.post('/user/login', async (request, reply) => {
    const body = loginBodySchema.parse(request.body);

    const user = await prisma.user.findUnique({
      where: { email: body.email },
      select: loginUserSelect,
    });

    if (!user || !verifyPassword(body.password, user.passwordHash)) {
      return reply.unauthorized('Invalid email or password');
    }

    if (user.status !== 'ACTIVE') {
      return reply.forbidden('User is disabled');
    }

    const twoFA = await prisma.twoFA.findUnique({
      where: { userId: user.id },
      select: {
        isEnabled: true,
      },
    });

    if (twoFA?.isEnabled) {
      reply.setCookie(twoFALoginChallengeCookieName, JSON.stringify({
        userId: user.id,
        issuedAt: Date.now(),
      }), {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        signed: true,
        maxAge: Math.floor(twoFALoginChallengeTtlMs / 1000),
      });

      return {
        success: true,
        requiresTwoFA: true,
      };
    }

    const { user: updatedUser, sessionToken } = await createSessionForUser(user.id);

    setSessionCookie(reply, sessionToken);

    return {
      success: true,
      user: serializeAuthUser(updatedUser),
    };
  });

  app.post('/user/login/2fa', async (request, reply) => {
    const body = twoFALoginBodySchema.parse(request.body);
    const challengeCookie = request.cookies[twoFALoginChallengeCookieName];

    if (!challengeCookie) {
      throw app.httpErrors.unauthorized('Two-factor login challenge is required');
    }

    const signedChallenge = request.unsignCookie(challengeCookie);

    if (!signedChallenge.valid) {
      reply.clearCookie(twoFALoginChallengeCookieName, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        signed: true,
      });
      throw app.httpErrors.unauthorized('Two-factor login challenge is invalid or expired');
    }

    let parsedChallenge: z.infer<typeof twoFALoginChallengeSchema>;

    try {
      parsedChallenge = twoFALoginChallengeSchema.parse(JSON.parse(signedChallenge.value));
    } catch {
      reply.clearCookie(twoFALoginChallengeCookieName, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        signed: true,
      });
      throw app.httpErrors.unauthorized('Two-factor login challenge is invalid or expired');
    }

    if (Date.now() - parsedChallenge.issuedAt > twoFALoginChallengeTtlMs) {
      reply.clearCookie(twoFALoginChallengeCookieName, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        signed: true,
      });
      throw app.httpErrors.unauthorized('Two-factor login challenge is invalid or expired');
    }

    const user = await prisma.user.findUnique({
      where: { id: parsedChallenge.userId },
      select: loginUserSelect,
    });

    if (!user) {
      reply.clearCookie(twoFALoginChallengeCookieName, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        signed: true,
      });
      throw app.httpErrors.unauthorized('Two-factor login challenge is invalid or expired');
    }

    if (user.status !== 'ACTIVE') {
      throw app.httpErrors.forbidden('User is disabled');
    }

    const twoFA = await prisma.twoFA.findUnique({
      where: { userId: user.id },
      select: twoFASelect,
    });

    if (!twoFA || !twoFA.isEnabled) {
      reply.clearCookie(twoFALoginChallengeCookieName, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        signed: true,
      });
      throw app.httpErrors.badRequest('Two-factor authentication is not enabled');
    }

    if (twoFA.lockedUntil && twoFA.lockedUntil > new Date()) {
      throw app.httpErrors.forbidden('Two-factor authentication is temporarily locked');
    }

    const submittedCode = body.code.trim();
    const totpValid = validateTotpCode(twoFA.secret, submittedCode, { window: 1 });
    let matchedBackupCodeId: string | null = null;

    if (!totpValid) {
      const normalizedBackupCode = normalizeBackupCode(submittedCode);

      if (isValidBackupCodeFormat(normalizedBackupCode)) {
        const backupCodes = await prisma.twoFABackupCode.findMany({
          where: {
            userId: user.id,
            isUsed: false,
          },
          select: backupCodeSelect,
        });

        const matchedBackupCode = backupCodes.find((backupCode) => verifyPassword(normalizedBackupCode, backupCode.codeHash));

        if (matchedBackupCode) {
          matchedBackupCodeId = matchedBackupCode.id;
        }
      }
    }

    if (!totpValid && !matchedBackupCodeId) {
      throw app.httpErrors.badRequest('Verification code or backup code is invalid');
    }

    const { user: updatedUser, sessionToken } = await prisma.$transaction(async (tx) => {
      if (matchedBackupCodeId) {
        await tx.twoFABackupCode.update({
          where: { id: matchedBackupCodeId },
          data: {
            isUsed: true,
            usedAt: new Date(),
          },
        });
      }

      await tx.twoFA.update({
        where: { userId: user.id },
        data: {
          failedAttempts: 0,
          lockedUntil: null,
          lastUsedAt: new Date(),
        },
      });

      return createSessionForUser(user.id, tx);
    });

    reply.clearCookie(twoFALoginChallengeCookieName, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      signed: true,
    });
    setSessionCookie(reply, sessionToken);

    return {
      success: true,
      user: serializeAuthUser(updatedUser),
    };
  });

  app.post('/user/password/forgot', async (request, reply) => {
    const body = forgotPasswordBodySchema.parse(request.body);
    const user = await prisma.user.findUnique({
      where: { email: body.email },
      select: {
        id: true,
        status: true,
      },
    });

    if (user?.status === 'ACTIVE') {
      const token = generatePasswordResetToken();
      await setPasswordResetToken(user.id, token);

      if (process.env.NODE_ENV === 'test') {
        reply.header('x-password-reset-token', token);
      } else if (await isMailDeliveryEnabled()) {
        await sendMailMessage(await buildPasswordResetMessage(body.email, token));
      } else {
        request.log.info({
          userId: user.id,
          email: body.email,
          resetPath: `/user/reset?token=${token}`,
        }, 'Password reset token generated');
      }
    }

    return {
      success: true,
    };
  });

  app.post('/user/password/reset', async (request) => {
    const body = resetPasswordBodySchema.parse(request.body);
    const user = await prisma.user.findUnique({
      where: { email: body.email },
      select: {
        id: true,
        status: true,
        passwordResetTokenHash: true,
        passwordResetTokenExpiresAt: true,
      },
    });

    if (!user || user.status !== 'ACTIVE' || !canUsePasswordResetToken(user, body.token)) {
      throw app.httpErrors.badRequest('Password reset token is invalid or expired');
    }

    await updateUserPassword({
      userId: user.id,
      password: body.password,
    });

    return {
      success: true,
    };
  });

  app.post('/user/email/verification', {
    preHandler: app.requireUser,
  }, async (request, reply) => {
    const currentUser = request.currentUser!;

    if (currentUser.status !== 'ACTIVE') {
      throw app.httpErrors.forbidden('User is disabled');
    }

    if (currentUser.emailVerifiedAt) {
      return {
        success: true,
      };
    }

    const token = generateEmailVerificationToken();
    await setEmailVerificationToken(currentUser.id, token);

    if (process.env.NODE_ENV === 'test') {
      reply.header('x-email-verification-token', token);
    } else if (await isMailDeliveryEnabled()) {
      await sendMailMessage(await buildEmailVerificationMessage(currentUser.email, token));
    } else {
      request.log.info({
        userId: currentUser.id,
        email: currentUser.email,
        verificationPath: `/verify-email?token=${token}`,
      }, 'Email verification token generated');
    }

    return {
      success: true,
    };
  });

  app.post('/user/email/verify', async (request) => {
    const body = verifyEmailBodySchema.parse(request.body);
    const tokenHash = hashEmailVerificationToken(body.token);

    const matchedUser = await prisma.user.findUnique({
      where: { emailVerificationTokenHash: tokenHash },
      select: {
        id: true,
        status: true,
        emailVerifiedAt: true,
        emailVerificationTokenHash: true,
        emailVerificationTokenExpiresAt: true,
      },
    });

    if (!matchedUser || matchedUser.status !== 'ACTIVE' || !canUseEmailVerificationToken(matchedUser, body.token)) {
      throw app.httpErrors.badRequest('Email verification token is invalid or expired');
    }

    await prisma.user.update({
      where: { id: matchedUser.id },
      data: {
        emailVerifiedAt: matchedUser.emailVerifiedAt ?? new Date(),
        emailVerificationTokenHash: null,
        emailVerificationTokenExpiresAt: null,
        emailVerificationRequestedAt: null,
      },
    });

    return {
      success: true,
    };
  });

  app.post('/user/redemption/redeem', {
    preHandler: app.requireUser,
  }, async (request) => {
    const body = redeemRedemptionBodySchema.parse(request.body);
    const now = new Date();
    const codePrefix = getRedemptionCodePrefix(body.code);

    const redemptions = await prisma.redemption.findMany({
      where: {
        codePrefix,
        status: 'ACTIVE',
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: now } },
        ],
      },
      select: {
        id: true,
        codeHash: true,
        quotaAmount: true,
      },
    });
    const redemption = redemptions.find((entry) => verifyRedemptionCode(body.code, entry.codeHash));

    if (!redemption) {
      throw app.httpErrors.badRequest('Redemption code is invalid or expired');
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedRedemption = await tx.redemption.updateMany({
        where: {
          id: redemption.id,
          status: 'ACTIVE',
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: now } },
          ],
        },
        data: {
          status: 'REDEEMED',
          redeemedByUserId: request.currentUser!.id,
          redeemedAt: now,
        },
      });

      if (updatedRedemption.count === 0) {
        throw app.httpErrors.badRequest('Redemption code is invalid or expired');
      }

      const user = await tx.user.update({
        where: { id: request.currentUser!.id },
        data: {
          quotaRemaining: { increment: redemption.quotaAmount },
        },
        select: {
          quotaRemaining: true,
          quotaUsed: true,
        },
      });

      return user;
    });

    return {
      success: true,
      quotaAmount: redemption.quotaAmount.toString(),
      quotaRemaining: result.quotaRemaining.toString(),
      quotaUsed: result.quotaUsed.toString(),
    };
  });

  app.post('/user/logout', {
    preHandler: app.requireUser,
  }, async (request, reply) => {
    await prisma.user.update({
      where: { id: request.currentUser!.id },
      data: { accessToken: null },
    });

    clearSessionCookie(reply);

    return {
      success: true,
    };
  });

  app.get('/user/token', {
    preHandler: app.requireUser,
  }, async (request, reply) => {
    const currentUser = request.currentUser;

    if (!currentUser) {
      throw app.httpErrors.unauthorized();
    }

    const { sessionToken } = await createSessionForUser(currentUser.id);

    setSessionCookie(reply, sessionToken);

    return {
      accessToken: sessionToken,
    };
  });
};

export default authRoutes;
