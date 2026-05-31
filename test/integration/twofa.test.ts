import { prisma } from '../../src/lib/prisma.js';
import { generateTotpCode } from '../../src/lib/totp.js';
import { closeTestApp, createTestApp } from '../helpers/app.js';
import { createAdminUser, createSessionForUser, createUser } from '../helpers/factories.js';

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

describe('two-factor authentication integration', () => {
  it('initializes, enables, reports, and disables 2FA', async () => {
    const user = await createUser();
    const token = await createSessionForUser(user.id);
    const app = await createTestApp();

    try {
      const cookies = {
        nodew_session: app.signCookie(token),
      };

      const statusBeforeResponse = await app.inject({
        method: 'GET',
        url: '/api/user/2fa/status',
        cookies,
      });

      expect(statusBeforeResponse.statusCode).toBe(200);
      expect(statusBeforeResponse.json().item).toMatchObject({
        enabled: false,
        locked: false,
        backupCodesRemaining: 0,
      });

      const setupResponse = await app.inject({
        method: 'POST',
        url: '/api/user/2fa/setup',
        cookies,
      });

      expect(setupResponse.statusCode).toBe(200);
      const setupBody = setupResponse.json().item;
      expect(setupBody.secret).toMatch(/^[A-Z2-7]+$/);
      expect(setupBody.qrCodeData).toContain('otpauth://totp/');
      expect(setupBody.backupCodes).toHaveLength(4);
      expect(setupBody.backupCodes.every((code: string) => /^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code))).toBe(true);

      const enableResponse = await app.inject({
        method: 'POST',
        url: '/api/user/2fa/enable',
        cookies,
        payload: {
          code: generateTotpCode(setupBody.secret),
        },
      });

      expect(enableResponse.statusCode).toBe(200);
      expect(enableResponse.json()).toEqual({
        success: true,
      });

      const statusAfterEnableResponse = await app.inject({
        method: 'GET',
        url: '/api/user/2fa/status',
        cookies,
      });

      expect(statusAfterEnableResponse.statusCode).toBe(200);
      expect(statusAfterEnableResponse.json().item).toMatchObject({
        enabled: true,
        locked: false,
        backupCodesRemaining: 4,
      });

      const disableResponse = await app.inject({
        method: 'POST',
        url: '/api/user/2fa/disable',
        cookies,
        payload: {
          code: generateTotpCode(setupBody.secret),
        },
      });

      expect(disableResponse.statusCode).toBe(200);
      expect(disableResponse.json()).toEqual({
        success: true,
      });

      const statusAfterDisableResponse = await app.inject({
        method: 'GET',
        url: '/api/user/2fa/status',
        cookies,
      });

      expect(statusAfterDisableResponse.statusCode).toBe(200);
      expect(statusAfterDisableResponse.json().item).toMatchObject({
        enabled: false,
        locked: false,
        backupCodesRemaining: 0,
      });

      const storedTwoFA = await prisma.twoFA.findUnique({
        where: { userId: user.id },
        select: { id: true },
      });

      expect(storedTwoFA).toBeNull();
    } finally {
      await closeTestApp(app);
    }
  });

  it('regenerates backup codes after TOTP confirmation', async () => {
    const user = await createUser();
    const token = await createSessionForUser(user.id);
    const app = await createTestApp();

    try {
      const cookies = {
        nodew_session: app.signCookie(token),
      };

      const setupResponse = await app.inject({
        method: 'POST',
        url: '/api/user/2fa/setup',
        cookies,
      });

      expect(setupResponse.statusCode).toBe(200);
      const setupBody = setupResponse.json().item;

      const enableResponse = await app.inject({
        method: 'POST',
        url: '/api/user/2fa/enable',
        cookies,
        payload: {
          code: generateTotpCode(setupBody.secret),
        },
      });

      expect(enableResponse.statusCode).toBe(200);

      const regenerateResponse = await app.inject({
        method: 'POST',
        url: '/api/user/2fa/backup-codes',
        cookies,
        payload: {
          code: generateTotpCode(setupBody.secret),
        },
      });

      expect(regenerateResponse.statusCode).toBe(200);
      const regenerateBody = regenerateResponse.json().item;
      expect(regenerateBody.backupCodes).toHaveLength(4);
      expect(regenerateBody.backupCodes.every((code: string) => /^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code))).toBe(true);

      const statusAfterRegenerateResponse = await app.inject({
        method: 'GET',
        url: '/api/user/2fa/status',
        cookies,
      });

      expect(statusAfterRegenerateResponse.statusCode).toBe(200);
      expect(statusAfterRegenerateResponse.json().item).toMatchObject({
        enabled: true,
        locked: false,
        backupCodesRemaining: 4,
      });

      const backupCodeState = await prisma.twoFABackupCode.findMany({
        where: { userId: user.id },
        select: {
          isUsed: true,
        },
      });

      expect(backupCodeState).toHaveLength(4);
      expect(backupCodeState.filter((entry) => entry.isUsed)).toHaveLength(0);
    } finally {
      await closeTestApp(app);
    }
  });

  it('allows an administrator to force disable user 2FA', async () => {
    const user = await createUser();
    const admin = await createAdminUser();
    const userToken = await createSessionForUser(user.id);
    const adminToken = await createSessionForUser(admin.id);
    const app = await createTestApp();

    try {
      const setupResponse = await app.inject({
        method: 'POST',
        url: '/api/user/2fa/setup',
        cookies: {
          nodew_session: app.signCookie(userToken),
        },
      });

      expect(setupResponse.statusCode).toBe(200);
      const setupBody = setupResponse.json().item;

      const enableResponse = await app.inject({
        method: 'POST',
        url: '/api/user/2fa/enable',
        cookies: {
          nodew_session: app.signCookie(userToken),
        },
        payload: {
          code: generateTotpCode(setupBody.secret),
        },
      });

      expect(enableResponse.statusCode).toBe(200);

      const adminListResponse = await app.inject({
        method: 'GET',
        url: '/api/users',
        cookies: {
          nodew_session: app.signCookie(adminToken),
        },
      });

      expect(adminListResponse.statusCode).toBe(200);
      const listedUser = adminListResponse.json().items.find((item: { id: string }) => item.id === user.id);
      expect(listedUser.twoFA).toMatchObject({
        isEnabled: true,
      });

      const resetResponse = await app.inject({
        method: 'DELETE',
        url: `/api/users/${user.id}/2fa`,
        cookies: {
          nodew_session: app.signCookie(adminToken),
        },
      });

      expect(resetResponse.statusCode).toBe(200);
      expect(resetResponse.json()).toEqual({
        success: true,
      });

      await expect(prisma.twoFA.findUnique({
        where: { userId: user.id },
      })).resolves.toBeNull();
      await expect(prisma.twoFABackupCode.count({
        where: { userId: user.id },
      })).resolves.toBe(0);
    } finally {
      await closeTestApp(app);
    }
  });

  it('requires a second factor before login and accepts backup codes', async () => {
    const user = await createUser();
    const token = await createSessionForUser(user.id);
    const app = await createTestApp();

    try {
      const cookies = {
        nodew_session: app.signCookie(token),
      };

      const setupResponse = await app.inject({
        method: 'POST',
        url: '/api/user/2fa/setup',
        cookies,
      });

      expect(setupResponse.statusCode).toBe(200);
      const setupBody = setupResponse.json().item;

      const enableResponse = await app.inject({
        method: 'POST',
        url: '/api/user/2fa/enable',
        cookies,
        payload: {
          code: generateTotpCode(setupBody.secret),
        },
      });

      expect(enableResponse.statusCode).toBe(200);

      const loginResponse = await app.inject({
        method: 'POST',
        url: '/api/user/login',
        payload: {
          email: user.email,
          password: 'testtest',
        },
      });

      expect(loginResponse.statusCode).toBe(200);
      expect(loginResponse.json()).toEqual({
        success: true,
        requiresTwoFA: true,
      });

      const challengeCookie = extractCookieValue(loginResponse, 'nodew_login_2fa');
      expect(challengeCookie).toBeTruthy();

      const verifyResponse = await app.inject({
        method: 'POST',
        url: '/api/user/login/2fa',
        cookies: {
          nodew_login_2fa: challengeCookie!,
        },
        payload: {
          code: setupBody.backupCodes[0],
        },
      });

      expect(verifyResponse.statusCode).toBe(200);
      expect(verifyResponse.json().success).toBe(true);
      expect(verifyResponse.json().user.email).toBe(user.email);

      const sessionCookie = extractCookieValue(verifyResponse, 'nodew_session');
      expect(sessionCookie).toBeTruthy();

      const currentUserResponse = await app.inject({
        method: 'GET',
        url: '/api/user/self',
        cookies: {
          nodew_session: sessionCookie!,
        },
      });

      expect(currentUserResponse.statusCode).toBe(200);
      expect(currentUserResponse.json().user.email).toBe(user.email);

      const backupCodeState = await prisma.twoFABackupCode.findMany({
        where: { userId: user.id },
        select: {
          isUsed: true,
        },
      });

      expect(backupCodeState.filter((entry) => entry.isUsed)).toHaveLength(1);
    } finally {
      await closeTestApp(app);
    }
  });
});
