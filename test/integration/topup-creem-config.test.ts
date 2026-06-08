import { closeTestApp, createTestApp } from '../helpers/app.js';
import { createSessionForUser, createUser } from '../helpers/factories.js';

const creemEnvKeys = [
  'APP_BASE_URL',
  'CREEM_TOPUP_ENABLED',
  'CREEM_API_KEY',
  'CREEM_WEBHOOK_SECRET',
  'CREEM_TEST_MODE',
  'CREEM_PRODUCTS',
] as const;

const savedEnv = new Map<string, string | undefined>();

beforeEach(() => {
  savedEnv.clear();

  for (const key of creemEnvKeys) {
    savedEnv.set(key, process.env[key]);
  }

  process.env.APP_BASE_URL = 'http://127.0.0.1:3000';
  process.env.CREEM_TOPUP_ENABLED = 'true';
  process.env.CREEM_API_KEY = 'creem-secret-key';
  process.env.CREEM_WEBHOOK_SECRET = 'creem-webhook-secret';
  process.env.CREEM_TEST_MODE = 'true';
  process.env.CREEM_PRODUCTS = JSON.stringify([
    {
      product_id: 'prod_test_100k',
      name: '100k quota',
      quota: 100000,
      price: 12.5,
      currency: 'USD',
    },
    {
      productId: 'prod_test_1m',
      quotaAmount: 1000000,
      amountCents: 9900,
      currency: 'eur',
    },
    {
      productId: '',
      quotaAmount: 100,
      amountCents: 100,
    },
  ]);
});

afterEach(() => {
  for (const key of creemEnvKeys) {
    const value = savedEnv.get(key);

    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

describe('Creem top-up configuration integration', () => {
  it('returns normalized public Creem configuration for signed-in users', async () => {
    const user = await createUser();
    const token = await createSessionForUser(user.id);
    const app = await createTestApp();

    try {
      const response = await app.inject({
        method: 'GET',
        url: '/api/user/topup/creem/config',
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
              productId: 'prod_test_100k',
              name: '100k quota',
              quotaAmount: 100000,
              amountCents: 1250,
              currency: 'usd',
            },
            {
              productId: 'prod_test_1m',
              name: 'prod_test_1m',
              quotaAmount: 1000000,
              amountCents: 9900,
              currency: 'eur',
            },
          ],
        },
      });
      expect(response.body).not.toContain('creem-secret-key');
      expect(response.body).not.toContain('creem-webhook-secret');
    } finally {
      await closeTestApp(app);
    }
  });

  it('disables Creem top-up when product configuration is invalid', async () => {
    process.env.CREEM_PRODUCTS = '{invalid json';
    const user = await createUser();
    const token = await createSessionForUser(user.id);
    const app = await createTestApp();

    try {
      const response = await app.inject({
        method: 'GET',
        url: '/api/user/topup/creem/config',
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
