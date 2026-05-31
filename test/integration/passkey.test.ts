import { prisma } from '../../src/lib/prisma.js';
import { closeTestApp, createTestApp } from '../helpers/app.js';
import { createAdminUser, createSessionForUser, createUser } from '../helpers/factories.js';

const readSetCookie = (response: { headers: Record<string, unknown> }, cookieName: string) => {
  const rawSetCookie = response.headers['set-cookie'];
  const cookies = Array.isArray(rawSetCookie)
    ? rawSetCookie
    : typeof rawSetCookie === 'string'
      ? [rawSetCookie]
      : [];

  return cookies.find((cookie) => typeof cookie === 'string' && cookie.startsWith(`${cookieName}=`)) ?? null;
};

const setPasskeyEnabled = async (enabled: boolean) => {
  await prisma.systemOption.upsert({
    where: { key: 'passkey_enabled' },
    update: { value: String(enabled) },
    create: {
      key: 'passkey_enabled',
      value: String(enabled),
    },
  });
};

describe('passkey integration', () => {
  it('returns disabled status and rejects login begin when passkey is disabled', async () => {
    const user = await createUser();
    const token = await createSessionForUser(user.id);
    const app = await createTestApp();

    try {
      const statusResponse = await app.inject({
        method: 'GET',
        url: '/api/status',
      });
      expect(statusResponse.statusCode).toBe(200);
      expect(statusResponse.json().passkey).toMatchObject({
        enabled: false,
      });

      const beginResponse = await app.inject({
        method: 'POST',
        url: '/api/user/passkey/login/begin',
      });

      expect(beginResponse.statusCode).toBe(400);

      const passkeyStatusResponse = await app.inject({
        method: 'GET',
        url: '/api/user/passkey',
        cookies: {
          nodew_session: app.signCookie(token),
        },
      });

      expect(passkeyStatusResponse.statusCode).toBe(200);
      expect(passkeyStatusResponse.json().item).toMatchObject({
        enabled: false,
        lastUsedAt: null,
      });
    } finally {
      await closeTestApp(app);
    }
  });

  it('creates a discoverable login challenge and sets the signed challenge cookie when enabled', async () => {
    await setPasskeyEnabled(true);
    const app = await createTestApp();

    try {
      const beginResponse = await app.inject({
        method: 'POST',
        url: '/api/user/passkey/login/begin',
      });

      expect(beginResponse.statusCode).toBe(200);
      expect(beginResponse.json().item).toMatchObject({
        challenge: expect.any(String),
      });
      expect(readSetCookie(beginResponse, 'nodew_passkey_login')).toBeTruthy();
    } finally {
      await closeTestApp(app);
    }
  });

  it('returns bad request for passkey verify when no verification cookie exists', async () => {
    await setPasskeyEnabled(true);
    const user = await createUser();
    const token = await createSessionForUser(user.id);
    const app = await createTestApp();

    try {
      const verifyResponse = await app.inject({
        method: 'POST',
        url: '/api/verify',
        cookies: {
          nodew_session: app.signCookie(token),
        },
        payload: {
          method: 'passkey',
        },
      });

      expect(verifyResponse.statusCode).toBe(400);
    } finally {
      await closeTestApp(app);
    }
  });

  it('requires secure verification before deleting a passkey binding', async () => {
    const user = await createUser();
    const token = await createSessionForUser(user.id);
    const app = await createTestApp();

    try {
      await prisma.passkeyCredential.create({
        data: {
          userId: user.id,
          credentialId: `cred-delete-${Date.now()}`,
          publicKey: Buffer.from('public-key').toString('base64url'),
          attestationType: 'none',
          aaguid: Buffer.from('aaguid').toString('base64url'),
          signCount: 0,
          cloneWarning: false,
          userPresent: true,
          userVerified: true,
          backupEligible: false,
          backupState: false,
          transports: '["internal"]',
          attachment: 'platform',
        },
      });

      const deleteResponse = await app.inject({
        method: 'DELETE',
        url: '/api/user/passkey',
        cookies: {
          nodew_session: app.signCookie(token),
        },
      });

      expect(deleteResponse.statusCode).toBe(403);
    } finally {
      await closeTestApp(app);
    }
  });

  it('lets an admin reset a user passkey binding', async () => {
    const admin = await createAdminUser();
    const user = await createUser();
    const adminToken = await createSessionForUser(admin.id);
    const app = await createTestApp();

    try {
      await prisma.passkeyCredential.create({
        data: {
          userId: user.id,
          credentialId: `cred-${Date.now()}`,
          publicKey: Buffer.from('public-key').toString('base64url'),
          attestationType: 'none',
          aaguid: Buffer.from('aaguid').toString('base64url'),
          signCount: 0,
          cloneWarning: false,
          userPresent: true,
          userVerified: true,
          backupEligible: false,
          backupState: false,
          transports: '["internal"]',
          attachment: 'platform',
        },
      });

      const resetResponse = await app.inject({
        method: 'DELETE',
        url: `/api/users/${user.id}/passkey`,
        cookies: {
          nodew_session: app.signCookie(adminToken),
        },
      });

      expect(resetResponse.statusCode).toBe(200);
      expect(resetResponse.json()).toEqual({
        success: true,
      });

      const credential = await prisma.passkeyCredential.findUnique({
        where: {
          userId: user.id,
        },
      });
      expect(credential).toBeNull();
    } finally {
      await closeTestApp(app);
    }
  });
});
