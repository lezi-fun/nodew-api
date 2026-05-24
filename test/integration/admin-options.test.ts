import { closeTestApp, createTestApp } from '../helpers/app.js';
import { createAdminUser, createSessionForUser } from '../helpers/factories.js';

describe('admin options integration', () => {
  it('updates an option and reflects it in setup responses', async () => {
    const admin = await createAdminUser();
    const token = await createSessionForUser(admin.id);
    const app = await createTestApp();

    try {
      const updateResponse = await app.inject({
        method: 'PUT',
        url: '/api/options/site_name',
        cookies: {
          nodew_session: app.signCookie(token),
        },
        payload: {
          value: 'NodeW Test Site',
        },
      });

      expect(updateResponse.statusCode).toBe(200);
      expect(updateResponse.json().item.value).toBe('NodeW Test Site');

      const setupResponse = await app.inject({
        method: 'GET',
        url: '/api/setup/config',
      });

      expect(setupResponse.statusCode).toBe(200);
      expect(setupResponse.json().config.siteName).toBe('NodeW Test Site');
    } finally {
      await closeTestApp(app);
    }
  });

  it('updates public content options and exposes them through site metadata', async () => {
    const admin = await createAdminUser();
    const token = await createSessionForUser(admin.id);
    const app = await createTestApp();

    try {
      const cookies = {
        nodew_session: app.signCookie(token),
      };

      const noticeResponse = await app.inject({
        method: 'PUT',
        url: '/api/options/notice',
        cookies,
        payload: {
          value: 'Preview maintenance notice.',
        },
      });
      const homeContentResponse = await app.inject({
        method: 'PUT',
        url: '/api/options/home_page_content',
        cookies,
        payload: {
          value: 'Custom home page content.',
        },
      });
      const siteResponse = await app.inject({
        method: 'GET',
        url: '/api/site',
      });

      expect(noticeResponse.statusCode).toBe(200);
      expect(homeContentResponse.statusCode).toBe(200);
      expect(siteResponse.statusCode).toBe(200);
      expect(siteResponse.json().data).toMatchObject({
        notice: 'Preview maintenance notice.',
        homePageContent: 'Custom home page content.',
      });
    } finally {
      await closeTestApp(app);
    }
  });

  it('rejects enabling registration email verification when mail delivery is disabled', async () => {
    const admin = await createAdminUser();
    const token = await createSessionForUser(admin.id);
    const app = await createTestApp();

    try {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/options/registration_email_verification_required',
        cookies: {
          nodew_session: app.signCookie(token),
        },
        payload: {
          value: true,
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().message).toBe('Mail delivery must be enabled before requiring email verification for registration');
    } finally {
      await closeTestApp(app);
    }
  });

  it('reports mail status and sends a test mail when delivery is enabled', async () => {
    process.env.MAIL_PROVIDER = 'smtp';
    process.env.MAIL_FROM = 'noreply@test.local';
    process.env.APP_BASE_URL = 'https://console.example.com';
    process.env.SMTP_HOST = 'smtp.test.local';
    process.env.SMTP_PORT = '465';
    process.env.SMTP_SECURE = 'true';
    process.env.SMTP_USER = 'tester';
    process.env.SMTP_PASS = 'secret';

    const sendMailMock = vi.fn();
    vi.doMock('nodemailer', () => ({
      createTransport: () => ({
        sendMail: sendMailMock,
      }),
    }));

    const admin = await createAdminUser();
    const token = await createSessionForUser(admin.id);
    const app = await createTestApp();

    try {
      const cookies = {
        nodew_session: app.signCookie(token),
      };

      const statusResponse = await app.inject({
        method: 'GET',
        url: '/api/options/mail/status',
        cookies,
      });

      expect(statusResponse.statusCode).toBe(200);
      expect(statusResponse.json().item).toMatchObject({
        provider: 'smtp',
        enabled: true,
        from: 'noreply@test.local',
        appBaseUrl: 'https://console.example.com',
      });

      const testResponse = await app.inject({
        method: 'POST',
        url: '/api/options/mail/test',
        cookies,
        payload: {
          email: 'deliver@test.local',
        },
      });

      expect(testResponse.statusCode).toBe(200);
      expect(testResponse.json()).toEqual({
        success: true,
        email: 'deliver@test.local',
      });
      expect(sendMailMock).toHaveBeenCalledTimes(1);
    } finally {
      vi.doUnmock('nodemailer');
      process.env.MAIL_PROVIDER = 'disabled';
      delete process.env.MAIL_FROM;
      delete process.env.SMTP_HOST;
      delete process.env.SMTP_PORT;
      delete process.env.SMTP_SECURE;
      delete process.env.SMTP_USER;
      delete process.env.SMTP_PASS;
      await closeTestApp(app);
    }
  });

  it('stores mail configuration in options and uses it for status plus test delivery', async () => {
    process.env.MAIL_PROVIDER = 'disabled';
    delete process.env.MAIL_FROM;
    delete process.env.APP_BASE_URL;
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_SECURE;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;

    const sendMailMock = vi.fn();
    vi.doMock('nodemailer', () => ({
      createTransport: (config: Record<string, unknown>) => ({
        sendMail: (...args: unknown[]) => {
          sendMailMock(config, ...args);
          return Promise.resolve();
        },
      }),
    }));

    const admin = await createAdminUser();
    const token = await createSessionForUser(admin.id);
    const app = await createTestApp();

    try {
      const cookies = {
        nodew_session: app.signCookie(token),
      };

      const saveResponse = await app.inject({
        method: 'PUT',
        url: '/api/options/mail/config',
        cookies,
        payload: {
          provider: 'smtp',
          appBaseUrl: 'https://mail.console.test',
          from: 'noreply@test.local',
          smtpHost: 'smtp.persisted.test',
          smtpPort: '465',
          smtpSecure: true,
          smtpUser: 'persisted-user',
          smtpPass: 'persisted-pass',
          resendApiKey: '',
        },
      });

      expect(saveResponse.statusCode).toBe(200);
      expect(saveResponse.json().item).toMatchObject({
        provider: 'smtp',
        appBaseUrl: 'https://mail.console.test',
        from: 'noreply@test.local',
        smtpHost: 'smtp.persisted.test',
        smtpPort: '465',
        smtpSecure: true,
        smtpUser: 'persisted-user',
      });

      const statusResponse = await app.inject({
        method: 'GET',
        url: '/api/options/mail/status',
        cookies,
      });

      expect(statusResponse.statusCode).toBe(200);
      expect(statusResponse.json().item).toMatchObject({
        provider: 'smtp',
        enabled: true,
        valid: true,
        from: 'noreply@test.local',
        appBaseUrl: 'https://mail.console.test',
        smtpHost: 'smtp.persisted.test',
        smtpPort: 465,
        smtpSecure: true,
        smtpUser: 'persisted-user',
      });

      const testResponse = await app.inject({
        method: 'POST',
        url: '/api/options/mail/test',
        cookies,
        payload: {
          email: 'persisted-recipient@test.local',
        },
      });

      expect(testResponse.statusCode).toBe(200);
      expect(sendMailMock).toHaveBeenCalledTimes(1);
      expect(sendMailMock.mock.calls[0]?.[0]).toMatchObject({
        host: 'smtp.persisted.test',
        port: 465,
        secure: true,
        auth: {
          user: 'persisted-user',
          pass: 'persisted-pass',
        },
      });
      expect(sendMailMock.mock.calls[0]?.[1]).toMatchObject({
        from: 'noreply@test.local',
        to: 'persisted-recipient@test.local',
      });
    } finally {
      vi.doUnmock('nodemailer');
      await closeTestApp(app);
    }
  });
});
