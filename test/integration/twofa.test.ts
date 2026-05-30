import { prisma } from '../../src/lib/prisma.js';
import { generateTotpCode } from '../../src/lib/totp.js';
import { closeTestApp, createTestApp } from '../helpers/app.js';
import { createSessionForUser, createUser } from '../helpers/factories.js';

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
});
