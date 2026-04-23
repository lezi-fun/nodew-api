import { prisma } from '../../src/lib/prisma.js';
import { closeTestApp, createTestApp } from '../helpers/app.js';
import { createAdminUser, createSessionForUser, createUser } from '../helpers/factories.js';

describe('auth lifecycle integration', () => {
  it('registers a user when registration is enabled', async () => {
    const admin = await createAdminUser();
    const token = await createSessionForUser(admin.id);
    await prisma.setupState.create({
      data: {
        isInitialized: true,
        initializedAt: new Date(),
      },
    });
    const app = await createTestApp();

    try {
      await app.inject({
        method: 'PUT',
        url: '/api/options/registration_enabled',
        cookies: {
          nodew_session: app.signCookie(token),
        },
        payload: {
          value: true,
        },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/user/register',
        payload: {
          email: 'register@test.local',
          username: 'register_user',
          password: 'testtest',
          displayName: 'Register User',
        },
      });

      expect(response.statusCode).toBe(201);
      expect(response.json().user.email).toBe('register@test.local');
      expect(response.json().user.displayName).toBe('Register User');
    } finally {
      await closeTestApp(app);
    }
  });

  it('rejects registration when registration is disabled', async () => {
    const admin = await createAdminUser();
    const token = await createSessionForUser(admin.id);
    await prisma.setupState.create({
      data: {
        isInitialized: true,
        initializedAt: new Date(),
      },
    });
    const app = await createTestApp();

    try {
      await app.inject({
        method: 'PUT',
        url: '/api/options/registration_enabled',
        cookies: {
          nodew_session: app.signCookie(token),
        },
        payload: {
          value: false,
        },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/user/register',
        payload: {
          email: 'blocked@test.local',
          username: 'blocked_user',
          password: 'testtest',
        },
      });

      expect(response.statusCode).toBe(403);
      expect(response.json().message).toBe('User registration is disabled');
    } finally {
      await closeTestApp(app);
    }
  });

  it('returns the same success response for forgot-password regardless of user existence', async () => {
    const user = await createUser({ email: 'forgot@test.local', username: 'forgot_user' });
    void user;
    const app = await createTestApp();

    try {
      const existingResponse = await app.inject({
        method: 'POST',
        url: '/api/user/password/forgot',
        payload: {
          email: 'forgot@test.local',
        },
      });
      const missingResponse = await app.inject({
        method: 'POST',
        url: '/api/user/password/forgot',
        payload: {
          email: 'missing@test.local',
        },
      });

      expect(existingResponse.statusCode).toBe(200);
      expect(missingResponse.statusCode).toBe(200);
      expect(existingResponse.json().success).toBe(true);
      expect(missingResponse.json().success).toBe(true);
      expect(existingResponse.json()).toEqual(missingResponse.json());

      const storedUser = await prisma.user.findUnique({
        where: { email: 'forgot@test.local' },
        select: {
          passwordResetTokenHash: true,
          passwordResetTokenExpiresAt: true,
          passwordResetRequestedAt: true,
        },
      });

      expect(storedUser?.passwordResetTokenHash).toBeTruthy();
      expect(storedUser?.passwordResetTokenExpiresAt).not.toBeNull();
      expect(storedUser?.passwordResetRequestedAt).not.toBeNull();
    } finally {
      await closeTestApp(app);
    }
  });

  it('resets password with a valid token and clears reset state', async () => {
    await createUser({ email: 'reset@test.local', username: 'reset_user', password: 'oldpassword' });
    const app = await createTestApp();

    try {
      const forgotResponse = await app.inject({
        method: 'POST',
        url: '/api/user/password/forgot',
        payload: {
          email: 'reset@test.local',
        },
      });
      const resetToken = forgotResponse.headers['x-password-reset-token'] as string;

      const resetResponse = await app.inject({
        method: 'POST',
        url: '/api/user/password/reset',
        payload: {
          email: 'reset@test.local',
          token: resetToken,
          password: 'newpassword',
        },
      });

      expect(resetResponse.statusCode).toBe(200);
      expect(resetResponse.json().success).toBe(true);

      const loginResponse = await app.inject({
        method: 'POST',
        url: '/api/user/login',
        payload: {
          email: 'reset@test.local',
          password: 'newpassword',
        },
      });

      expect(loginResponse.statusCode).toBe(200);

      const storedUser = await prisma.user.findUnique({
        where: { email: 'reset@test.local' },
        select: {
          passwordResetTokenHash: true,
          passwordResetTokenExpiresAt: true,
          passwordResetRequestedAt: true,
          accessToken: true,
        },
      });

      expect(storedUser?.passwordResetTokenHash).toBeNull();
      expect(storedUser?.passwordResetTokenExpiresAt).toBeNull();
      expect(storedUser?.passwordResetRequestedAt).toBeNull();
      expect(storedUser?.accessToken).toBeTruthy();
    } finally {
      await closeTestApp(app);
    }
  });

  it('rejects expired reset tokens', async () => {
    await createUser({ email: 'expired@test.local', username: 'expired_user' });
    const app = await createTestApp();

    try {
      const forgotResponse = await app.inject({
        method: 'POST',
        url: '/api/user/password/forgot',
        payload: {
          email: 'expired@test.local',
        },
      });
      const resetToken = forgotResponse.headers['x-password-reset-token'] as string;

      await prisma.user.update({
        where: { email: 'expired@test.local' },
        data: {
          passwordResetTokenExpiresAt: new Date(Date.now() - 1000),
        },
      });

      const resetResponse = await app.inject({
        method: 'POST',
        url: '/api/user/password/reset',
        payload: {
          email: 'expired@test.local',
          token: resetToken,
          password: 'newpassword',
        },
      });

      expect(resetResponse.statusCode).toBe(400);
      expect(resetResponse.json().message).toBe('Password reset token is invalid or expired');
    } finally {
      await closeTestApp(app);
    }
  });

  it('revokes session state after self password change', async () => {
    const user = await createUser({ email: 'selfpass@test.local', username: 'selfpass_user', password: 'oldpassword' });
    const loginApp = await createTestApp();

    try {
      const loginResponse = await loginApp.inject({
        method: 'POST',
        url: '/api/user/login',
        payload: {
          email: 'selfpass@test.local',
          password: 'oldpassword',
        },
      });
      const cookie = loginResponse.cookies.find((entry) => entry.name === 'nodew_session');

      expect(cookie?.value).toBeTruthy();

      const changeResponse = await loginApp.inject({
        method: 'POST',
        url: '/api/user/self/password',
        cookies: {
          nodew_session: cookie!.value,
        },
        payload: {
          currentPassword: 'oldpassword',
          newPassword: 'newpassword',
        },
      });

      expect(changeResponse.statusCode).toBe(200);

      const selfResponse = await loginApp.inject({
        method: 'GET',
        url: '/api/user/self',
        cookies: {
          nodew_session: cookie!.value,
        },
      });

      expect(selfResponse.statusCode).toBe(401);

      const storedUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { accessToken: true },
      });

      expect(storedUser?.accessToken).toBeNull();
    } finally {
      await closeTestApp(loginApp);
    }
  });
});
