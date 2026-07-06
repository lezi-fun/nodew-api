import { closeTestApp, createTestApp } from '../helpers/app.js';
import { mockFetchSequence } from '../helpers/fetch.js';
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

  it('updates check-in configuration through admin options', async () => {
    const admin = await createAdminUser();
    const token = await createSessionForUser(admin.id);
    const app = await createTestApp();

    try {
      const cookies = {
        nodew_session: app.signCookie(token),
      };

      const enabledResponse = await app.inject({
        method: 'PUT',
        url: '/api/options/checkin_enabled',
        cookies,
        payload: {
          value: false,
        },
      });
      const minResponse = await app.inject({
        method: 'PUT',
        url: '/api/options/checkin_min_quota',
        cookies,
        payload: {
          value: 300,
        },
      });
      const maxResponse = await app.inject({
        method: 'PUT',
        url: '/api/options/checkin_max_quota',
        cookies,
        payload: {
          value: 500,
        },
      });

      expect(enabledResponse.statusCode).toBe(200);
      expect(minResponse.statusCode).toBe(200);
      expect(maxResponse.statusCode).toBe(200);

      const optionsResponse = await app.inject({
        method: 'GET',
        url: '/api/options',
        cookies,
      });

      expect(optionsResponse.statusCode).toBe(200);
      expect(optionsResponse.json().items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ key: 'checkin_enabled', value: 'false' }),
          expect.objectContaining({ key: 'checkin_min_quota', value: '300' }),
          expect.objectContaining({ key: 'checkin_max_quota', value: '500' }),
        ]),
      );
    } finally {
      await closeTestApp(app);
    }
  });

  it('stores subscription plans through admin options', async () => {
    const admin = await createAdminUser();
    const token = await createSessionForUser(admin.id);
    const app = await createTestApp();

    try {
      const cookies = {
        nodew_session: app.signCookie(token),
      };

      const response = await app.inject({
        method: 'PUT',
        url: '/api/options/subscription_plans',
        cookies,
        payload: {
          value: JSON.stringify([
            {
              id: 'monthly-basic',
              title: '基础版',
              subtitle: '适合轻量使用',
              description: '按月提供固定额度与基础权益',
              badge: '热门',
              priceAmount: 29.9,
              currency: 'CNY',
              quota: '每月 500,000 额度',
              duration: '30 天',
              features: ['基础模型访问', '标准优先级'],
              enabled: true,
              sortOrder: 100,
            },
          ]),
        },
      });

      expect(response.statusCode).toBe(200);

      const listResponse = await app.inject({
        method: 'GET',
        url: '/api/options',
        cookies,
      });

      expect(listResponse.statusCode).toBe(200);
      expect(listResponse.json().items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            key: 'subscription_plans',
          }),
        ]),
      );
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

  it('stores oidc oauth configuration and enables oidc status', async () => {
    process.env.APP_BASE_URL = 'https://console.example.com';
    delete process.env.OIDC_OAUTH_CLIENT_ID;
    delete process.env.OIDC_OAUTH_CLIENT_SECRET;
    delete process.env.OIDC_OAUTH_AUTHORIZATION_URL;
    delete process.env.OIDC_OAUTH_TOKEN_URL;
    delete process.env.OIDC_OAUTH_USERINFO_URL;

    const admin = await createAdminUser();
    const token = await createSessionForUser(admin.id);
    const app = await createTestApp();

    try {
      const cookies = {
        nodew_session: app.signCookie(token),
      };

      const saveResponse = await app.inject({
        method: 'PUT',
        url: '/api/options/oauth/config',
        cookies,
        payload: {
          oidc: {
            enabled: true,
            wellKnownUrl: 'https://id.example.test/.well-known/openid-configuration',
            clientId: 'settings-oidc-client',
            clientSecret: 'settings-oidc-secret',
            authorizationUrl: 'https://id.example.test/oauth2/authorize',
            tokenUrl: 'https://id.example.test/oauth2/token',
            userInfoUrl: 'https://id.example.test/oauth2/userinfo',
            scope: 'openid profile email',
          },
        },
      });

      expect(saveResponse.statusCode).toBe(200);
      expect(saveResponse.json().item.oidc).toMatchObject({
        enabled: true,
        clientId: 'settings-oidc-client',
        authorizationUrl: 'https://id.example.test/oauth2/authorize',
      });
      expect(saveResponse.json().status.oidc.enabled).toBe(true);

      const statusResponse = await app.inject({
        method: 'GET',
        url: '/api/status',
      });

      expect(statusResponse.statusCode).toBe(200);
      expect(statusResponse.json().oauth.oidc).toEqual({
        enabled: true,
      });

      const oauthStateResponse = await app.inject({
        method: 'GET',
        url: '/api/oauth/state?provider=oidc&redirectTo=/console',
      });

      expect(oauthStateResponse.statusCode).toBe(200);
      expect(oauthStateResponse.json().data.authorizeUrl).toContain('client_id=settings-oidc-client');
      expect(oauthStateResponse.json().data.authorizeUrl).toContain('https://id.example.test/oauth2/authorize');
    } finally {
      delete process.env.APP_BASE_URL;
      await closeTestApp(app);
    }
  });

  it('fetches oidc discovery endpoints for admin oauth settings', async () => {
    const admin = await createAdminUser();
    const token = await createSessionForUser(admin.id);
    const app = await createTestApp();

    try {
      mockFetchSequence([
        {
          body: {
            authorization_endpoint: 'https://id.example.test/oauth2/authorize',
            token_endpoint: 'https://id.example.test/oauth2/token',
            userinfo_endpoint: 'https://id.example.test/oauth2/userinfo',
          },
        },
      ]);

      const response = await app.inject({
        method: 'POST',
        url: '/api/options/oauth/oidc/discover',
        cookies: {
          nodew_session: app.signCookie(token),
        },
        payload: {
          wellKnownUrl: 'https://id.example.test/.well-known/openid-configuration',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().item).toEqual({
        authorizationUrl: 'https://id.example.test/oauth2/authorize',
        tokenUrl: 'https://id.example.test/oauth2/token',
        userInfoUrl: 'https://id.example.test/oauth2/userinfo',
      });
    } finally {
      await closeTestApp(app);
    }
  });

  it('manages custom oauth provider list from admin settings', async () => {
    const admin = await createAdminUser();
    const token = await createSessionForUser(admin.id);
    const app = await createTestApp();

    try {
      const cookies = {
        nodew_session: app.signCookie(token),
      };

      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/options/oauth/custom-providers',
        cookies,
        payload: {
          name: 'Example IdP',
          slug: 'example-idp',
          icon: 'key',
          enabled: true,
          clientId: 'example-client-id',
          clientSecret: 'example-client-secret',
          authorizationUrl: 'https://id.example.test/oauth2/authorize',
          tokenUrl: 'https://id.example.test/oauth2/token',
          userInfoUrl: 'https://id.example.test/oauth2/userinfo',
          scopes: 'openid profile email',
          userIdField: 'sub',
          usernameField: 'preferred_username',
          displayNameField: 'name',
          emailField: 'email',
          wellKnownUrl: 'https://id.example.test/.well-known/openid-configuration',
          authStyle: 0,
          accessPolicy: '',
          accessDeniedMessage: '',
        },
      });

      expect(createResponse.statusCode).toBe(200);
      expect(createResponse.json().item).toMatchObject({
        id: expect.any(String),
        name: 'Example IdP',
        slug: 'example-idp',
        enabled: true,
        hasClientSecret: true,
      });
      expect(createResponse.json().item.clientSecret).toBeUndefined();

      const providerId = createResponse.json().item.id as string;
      const listResponse = await app.inject({
        method: 'GET',
        url: '/api/options/oauth/custom-providers',
        cookies,
      });

      expect(listResponse.statusCode).toBe(200);
      expect(listResponse.json().items).toEqual([
        expect.objectContaining({
          id: providerId,
          slug: 'example-idp',
          hasClientSecret: true,
        }),
      ]);

      const updateResponse = await app.inject({
        method: 'PUT',
        url: `/api/options/oauth/custom-providers/${providerId}`,
        cookies,
        payload: {
          name: 'Example Identity',
          slug: 'example-identity',
          icon: 'shield',
          enabled: false,
          clientId: 'updated-client-id',
          clientSecret: '',
          authorizationUrl: 'https://id.example.test/oauth2/authorize',
          tokenUrl: 'https://id.example.test/oauth2/token',
          userInfoUrl: 'https://id.example.test/oauth2/userinfo',
          scopes: 'openid profile email',
          userIdField: 'sub',
          usernameField: 'preferred_username',
          displayNameField: 'name',
          emailField: 'email',
          wellKnownUrl: '',
          authStyle: 2,
          accessPolicy: '{"field":"groups","operator":"contains","value":"staff"}',
          accessDeniedMessage: 'Access denied',
        },
      });

      expect(updateResponse.statusCode).toBe(200);
      expect(updateResponse.json().item).toMatchObject({
        id: providerId,
        name: 'Example Identity',
        slug: 'example-identity',
        enabled: false,
        clientId: 'updated-client-id',
        authStyle: 2,
        hasClientSecret: true,
      });

      const deleteResponse = await app.inject({
        method: 'DELETE',
        url: `/api/options/oauth/custom-providers/${providerId}`,
        cookies,
      });

      expect(deleteResponse.statusCode).toBe(200);
      expect(deleteResponse.json()).toEqual({ success: true });

      const finalListResponse = await app.inject({
        method: 'GET',
        url: '/api/options/oauth/custom-providers',
        cookies,
      });

      expect(finalListResponse.statusCode).toBe(200);
      expect(finalListResponse.json().items).toEqual([]);
    } finally {
      await closeTestApp(app);
    }
  });
});
