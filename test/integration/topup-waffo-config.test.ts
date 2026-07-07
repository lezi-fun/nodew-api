import { generateKeyPairSync } from 'node:crypto';

import { prisma } from '../../src/lib/prisma.js';
import { closeTestApp, createTestApp } from '../helpers/app.js';
import { mockFetchOnce } from '../helpers/fetch.js';
import { createSessionForUser, createUser } from '../helpers/factories.js';

const waffoEnvKeys = [
  'APP_BASE_URL',
  'WAFFO_TOPUP_ENABLED',
  'WAFFO_API_KEY',
  'WAFFO_PRIVATE_KEY',
  'WAFFO_WEBHOOK_SECRET',
  'WAFFO_TEST_MODE',
  'WAFFO_PRODUCTS',
] as const;

const savedEnv = new Map<string, string | undefined>();

const createTestWaffoPrivateKey = () => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });

  return privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64');
};

beforeEach(() => {
  savedEnv.clear();

  for (const key of waffoEnvKeys) {
    savedEnv.set(key, process.env[key]);
  }

  process.env.APP_BASE_URL = 'http://127.0.0.1:3000';
  process.env.WAFFO_TOPUP_ENABLED = 'true';
  process.env.WAFFO_API_KEY = 'waffo-secret-key';
  process.env.WAFFO_PRIVATE_KEY = createTestWaffoPrivateKey();
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

  it('creates a checkout order for a configured Waffo product', async () => {
    const user = await createUser({ quotaRemaining: 25n });
    const token = await createSessionForUser(user.id);
    const fetchMock = mockFetchOnce({
      body: {
        code: 0,
        msg: 'success',
        data: {
          id: 'waffo-checkout-123',
          orderId: 'waffo-order-123',
          orderAction: 'https://checkout.waffo.com/orders/waffo-checkout-123',
        },
      },
    });
    const app = await createTestApp();

    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/user/topup/waffo/checkout',
        cookies: {
          nodew_session: app.signCookie(token),
        },
        payload: {
          productId: 'waffo_test_100k',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        success: true,
        checkoutUrl: 'https://checkout.waffo.com/orders/waffo-checkout-123',
        order: {
          status: 'PENDING',
          quotaAmount: '100000',
          amountCents: 850,
          currency: 'usd',
          stripeSessionId: null,
        },
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);

      const [url, init] = fetchMock.mock.calls[0]!;
      expect(url).toBe('https://sandbox-api.waffo.com/v1/order/create');
      expect(init).toMatchObject({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': 'waffo-secret-key',
        },
      });
      expect((init?.headers as Record<string, string>)['X-SIGNATURE']).toEqual(expect.any(String));

      const waffoBody = JSON.parse(String(init?.body)) as {
        paymentRequestId: string;
        merchantOrderId: string;
        orderAmount: string;
        orderCurrency: string;
        orderDescription: string;
        notifyUrl: string;
        successRedirectUrl: string;
        failedRedirectUrl: string;
        userInfo: {
          userId: string;
          userEmail: string;
          userTerminal: string;
        };
        paymentInfo: {
          productName: string;
        };
        metadata: {
          provider: string;
          productId: string;
          quotaAmount: string;
          amountCents: string;
        };
      };
      expect(waffoBody.paymentRequestId).toBe(waffoBody.merchantOrderId);
      expect(waffoBody.orderAmount).toBe('8.50');
      expect(waffoBody.orderCurrency).toBe('USD');
      expect(waffoBody.orderDescription).toBe('100k quota');
      expect(waffoBody.notifyUrl).toBe('http://127.0.0.1:3000/api/user/topup/waffo/webhook');
      expect(waffoBody.successRedirectUrl).toBe(`http://127.0.0.1:3000/console/topup?waffo=success&order=${waffoBody.paymentRequestId}`);
      expect(waffoBody.failedRedirectUrl).toBe(waffoBody.successRedirectUrl);
      expect(waffoBody.userInfo).toEqual({
        userId: user.id,
        userEmail: user.email,
        userTerminal: 'WEB',
      });
      expect(waffoBody.paymentInfo.productName).toBe('ONE_TIME_PAYMENT');
      expect(waffoBody.metadata).toMatchObject({
        provider: 'waffo',
        productId: 'waffo_test_100k',
        quotaAmount: '100000',
        amountCents: '850',
      });

      const order = await prisma.topUpOrder.findUnique({
        where: { id: waffoBody.paymentRequestId },
      });
      const storedUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { quotaRemaining: true },
      });

      expect(order).toMatchObject({
        userId: user.id,
        provider: 'WAFFO',
        status: 'PENDING',
        quotaAmount: 100000n,
        amountCents: 850,
        currency: 'usd',
        waffoCheckoutId: 'waffo-checkout-123',
        waffoOrderId: 'waffo-order-123',
        waffoProductId: 'waffo_test_100k',
      });
      expect(storedUser?.quotaRemaining).toBe(25n);
    } finally {
      await closeTestApp(app);
    }
  });

  it('rejects checkout when Waffo is disabled or the product is unknown', async () => {
    const user = await createUser();
    const token = await createSessionForUser(user.id);
    const app = await createTestApp();

    try {
      const invalidProductResponse = await app.inject({
        method: 'POST',
        url: '/api/user/topup/waffo/checkout',
        cookies: {
          nodew_session: app.signCookie(token),
        },
        payload: {
          productId: 'waffo_missing',
        },
      });

      process.env.WAFFO_TOPUP_ENABLED = 'false';

      const disabledResponse = await app.inject({
        method: 'POST',
        url: '/api/user/topup/waffo/checkout',
        cookies: {
          nodew_session: app.signCookie(token),
        },
        payload: {
          productId: 'waffo_test_100k',
        },
      });

      expect(invalidProductResponse.statusCode).toBe(400);
      expect(invalidProductResponse.json().message).toBe('Waffo product is not configured');
      expect(disabledResponse.statusCode).toBe(400);
      expect(disabledResponse.json().message).toBe('Waffo top-up is not configured');
    } finally {
      await closeTestApp(app);
    }
  });
});
