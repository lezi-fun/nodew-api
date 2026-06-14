import { closeTestApp, createTestApp } from '../helpers/app.js';
import { createSessionForUser, createUser } from '../helpers/factories.js';

const waffoEnvKeys = [
  'APP_BASE_URL',
  'WAFFO_TOPUP_ENABLED',
  'WAFFO_API_KEY',
  'WAFFO_WEBHOOK_SECRET',
  'WAFFO_TEST_MODE',
  'WAFFO_PRODUCTS',
] as const;

const savedEnv = new Map<string, string | undefined>();

beforeEach(() => {
  savedEnv.clear();

  for (const key of waffoEnvKeys) {
    savedEnv.set(key, process.env[key]);
  }

  process.env.APP_BASE_URL = 'http://127.0.0.1:3000';
  process.env.WAFFO_TOPUP_ENABLED = 'true';
  process.env.WAFFO_API_KEY = 'waffo-secret-key';
  process.env.WAFFO_WEBHOOK_SECRET = 'waffo-webhook-secret';
  process.env.WAFFO_TEST_MODE = 'true';
  process.env.WAFFO_PRODUCTS = JSON.stringify([
    {
      product_id: 'waffo_test_100k',
      name: '100k quota',
      quota: 100000,
      price: 8.5,
      currency: 'USD',
    },
    {
      productId: 'waffo_test_1m',
      quotaAmount: 1000000,
      amountCents: 7600,
      currency: 'cny',
    },
    {
      productId: '',
      quotaAmount: 100,
      amountCents: 100,
    },
  ]);
});

afterEach(() => {
  for (const key of waffoEnvKeys) {
    const value = savedEnv.get(key);

    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

describe('Waffo top-up configuration integration', () => {
  it('returns normalized public Waffo configuration for signed-in users', async () => {
    const user = await createUser();
    const token = await createSessionForUser(user.id);
    const app = await createTestApp();

    try {
      const response = await app.inject({
        method: 'GET',
        url: '/api/user/topup/waffo/config',
        cookies: {
          nodew_session: app.signCookie(token),
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        item: {
          enabled: true,
          configured: true,
          webhookConfigured: true,
          testMode: true,
          products: [
            {
              productId: 'waffo_test_100k',
              name: '100k quota',
              quotaAmount: 100000,
              amountCents: 850,
              currency: 'usd',
            },
            {
              productId: 'waffo_test_1m',
              name: 'waffo_test_1m',
              quotaAmount: 1000000,
              amountCents: 7600,
              currency: 'cny',
            },
          ],
        },
      });
      expect(response.body).not.toContain('waffo-secret-key');
      expect(response.body).not.toContain('waffo-webhook-secret');
    } finally {
      await closeTestApp(app);
    }
  });

  it('disables Waffo top-up when product configuration is invalid', async () => {
    process.env.WAFFO_PRODUCTS = '{invalid json';
    const user = await createUser();
    const token = await createSessionForUser(user.id);
    const app = await createTestApp();

    try {
      const response = await app.inject({
        method: 'GET',
        url: '/api/user/topup/waffo/config',
        cookies: {
          nodew_session: app.signCookie(token),
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        item: {
          enabled: false,
          configured: false,
          products: [],
        },
      });
    } finally {
      await closeTestApp(app);
    }
  });
});
