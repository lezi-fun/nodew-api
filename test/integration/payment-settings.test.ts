import { closeTestApp, createTestApp } from '../helpers/app.js';
import { mockFetchOnce } from '../helpers/fetch.js';
import { createAdminUser, createSessionForUser } from '../helpers/factories.js';
import { prisma } from '../../src/lib/prisma.js';

describe('payment settings integration', () => {
  it('stores Stripe settings without exposing secrets and applies them immediately', async () => {
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.STRIPE_TOPUP_ENABLED;
    delete process.env.APP_BASE_URL;

    const admin = await createAdminUser();
    const token = await createSessionForUser(admin.id);
    const app = await createTestApp();
    const cookies = { nodew_session: app.signCookie(token) };

    try {
      const saveResponse = await app.inject({
        method: 'PUT',
        url: '/api/options/payment/config',
        cookies,
        payload: {
          appBaseUrl: 'https://billing.example.test',
          stripe: {
            enabled: true,
            secretKey: 'stripe-secret-key',
            webhookSecret: 'stripe-webhook-secret',
            currency: 'CNY',
            quotaPerUnit: 250000,
            unitAmountCents: 299,
            minUnits: 2,
          },
        },
      });

      expect(saveResponse.statusCode).toBe(200);
      expect(saveResponse.json().item).toMatchObject({
        appBaseUrl: 'https://billing.example.test',
        stripe: {
          enabled: true,
          secretKey: '',
          webhookSecret: '',
          hasSecretKey: true,
          hasWebhookSecret: true,
          currency: 'cny',
          quotaPerUnit: 250000,
          unitAmountCents: 299,
          minUnits: 2,
        },
      });

      const configResponse = await app.inject({
        method: 'GET',
        url: '/api/options/payment/config',
        cookies,
      });
      const publicResponse = await app.inject({
        method: 'GET',
        url: '/api/user/topup/stripe/config',
        cookies,
      });

      expect(configResponse.statusCode).toBe(200);
      expect(configResponse.json().item.stripe).toMatchObject({
        secretKey: '',
        webhookSecret: '',
        hasSecretKey: true,
        hasWebhookSecret: true,
      });
      expect(publicResponse.statusCode).toBe(200);
      expect(publicResponse.json().item).toMatchObject({
        enabled: true,
        configured: true,
        currency: 'cny',
        quotaPerUnit: 250000,
        unitAmountCents: 299,
        minUnits: 2,
      });
    } finally {
      await closeTestApp(app);
    }
  });

  it('uses stored Stripe secrets and app URL when creating checkout sessions', async () => {
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_TOPUP_ENABLED;
    delete process.env.APP_BASE_URL;
    const admin = await createAdminUser();
    const token = await createSessionForUser(admin.id);
    const app = await createTestApp();
    const cookies = { nodew_session: app.signCookie(token) };

    try {
      await app.inject({
        method: 'PUT',
        url: '/api/options/payment/config',
        cookies,
        payload: {
          appBaseUrl: 'https://billing.example.test',
          stripe: {
            enabled: true,
            secretKey: 'stored-stripe-secret',
            currency: 'USD',
            quotaPerUnit: 1000,
            unitAmountCents: 150,
            minUnits: 1,
          },
        },
      });
      const fetchMock = mockFetchOnce({
        body: { id: 'cs_stored', url: 'https://checkout.stripe.test/session' },
      });
      const checkoutResponse = await app.inject({
        method: 'POST',
        url: '/api/user/topup/stripe/checkout',
        cookies,
        payload: { units: 1 },
      });

      expect(checkoutResponse.statusCode).toBe(200);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const headers = fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>;
      expect(headers.Authorization).toContain('stored-stripe-secret');
      const body = new URLSearchParams(String(fetchMock.mock.calls[0]?.[1]?.body));
      expect(body.get('success_url')).toContain('https://billing.example.test/console/topup');
    } finally {
      vi.restoreAllMocks();
      await closeTestApp(app);
    }
  });

  it('stores Creem and Waffo settings without exposing credentials', async () => {
    for (const key of [
      'CREEM_API_KEY', 'CREEM_WEBHOOK_SECRET', 'CREEM_PRODUCTS',
      'WAFFO_API_KEY', 'WAFFO_PRIVATE_KEY', 'WAFFO_PUBLIC_KEY', 'WAFFO_PRODUCTS',
    ]) delete process.env[key];
    const admin = await createAdminUser();
    const token = await createSessionForUser(admin.id);
    const app = await createTestApp();
    const cookies = { nodew_session: app.signCookie(token) };

    try {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/options/payment/config',
        cookies,
        payload: {
          appBaseUrl: 'https://billing.example.test',
          creem: {
            enabled: true,
            testMode: true,
            apiKey: 'creem-api-key',
            webhookSecret: 'creem-webhook-secret',
            products: [{ productId: 'creem-10', name: 'Creem 10', quotaAmount: 10000, amountCents: 500, currency: 'USD' }],
          },
          waffo: {
            enabled: true,
            testMode: true,
            apiKey: 'waffo-api-key',
            privateKey: 'waffo-private-key',
            publicKey: 'waffo-public-key',
            products: [{ productId: 'waffo-20', name: 'Waffo 20', quotaAmount: 20000, amountCents: 900, currency: 'CNY' }],
          },
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().item.creem).toMatchObject({
        enabled: true, testMode: true, apiKey: '', webhookSecret: '',
        hasApiKey: true, hasWebhookSecret: true,
        products: [{ productId: 'creem-10', currency: 'usd' }],
      });
      expect(response.json().item.waffo).toMatchObject({
        enabled: true, testMode: true, apiKey: '', privateKey: '', publicKey: '',
        hasApiKey: true, hasPrivateKey: true, hasPublicKey: true,
        products: [{ productId: 'waffo-20', currency: 'cny' }],
      });
    } finally {
      await closeTestApp(app);
    }
  });

  it('rejects invalid payment products as a client error', async () => {
    const admin = await createAdminUser();
    const token = await createSessionForUser(admin.id);
    const app = await createTestApp();

    try {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/options/payment/config',
        cookies: { nodew_session: app.signCookie(token) },
        payload: {
          creem: {
            products: [{ productId: 'broken', name: 'Broken', quotaAmount: 0, amountCents: 0, currency: 'USD' }],
          },
        },
      });

      expect(response.statusCode).toBe(400);
    } finally {
      await closeTestApp(app);
    }
  });

  it('uses environment credentials as fallback without copying them into stored settings', async () => {
    process.env.STRIPE_SECRET_KEY = 'environment-stripe-secret';
    process.env.STRIPE_WEBHOOK_SECRET = 'environment-webhook-secret';
    process.env.APP_BASE_URL = 'https://environment.example.test';
    const admin = await createAdminUser();
    const token = await createSessionForUser(admin.id);
    const app = await createTestApp();

    try {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/options/payment/config',
        cookies: { nodew_session: app.signCookie(token) },
        payload: {
          stripe: { enabled: true, currency: 'EUR', unitAmountCents: 250 },
        },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().item.stripe.hasSecretKey).toBe(true);

      const option = await prisma.systemOption.findUnique({ where: { key: 'payment_config' } });
      expect(option?.value).not.toContain('environment-stripe-secret');
      expect(option?.value).not.toContain('environment-webhook-secret');
    } finally {
      delete process.env.STRIPE_SECRET_KEY;
      delete process.env.STRIPE_WEBHOOK_SECRET;
      delete process.env.APP_BASE_URL;
      await closeTestApp(app);
    }
  });
});
