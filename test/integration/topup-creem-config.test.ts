import { createHmac } from 'node:crypto';

import { prisma } from '../../src/lib/prisma.js';
import { closeTestApp, createTestApp } from '../helpers/app.js';
import { mockFetchOnce } from '../helpers/fetch.js';
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

const signCreemPayload = (payload: string, secret = 'creem-webhook-secret') =>
  createHmac('sha256', secret).update(payload).digest('hex');

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

  it('creates a Checkout Session for a configured Creem product', async () => {
    const user = await createUser({ quotaRemaining: 25n });
    const token = await createSessionForUser(user.id);
    const fetchMock = mockFetchOnce({
      body: {
        id: 'chk_test_123',
        checkout_url: 'https://www.creem.io/checkout/chk_test_123',
        request_id: 'creem-request-123',
        order: {
          id: 'creem-order-123',
        },
      },
    });
    const app = await createTestApp();

    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/user/topup/creem/checkout',
        cookies: {
          nodew_session: app.signCookie(token),
        },
        payload: {
          productId: 'prod_test_100k',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        success: true,
        checkoutUrl: 'https://www.creem.io/checkout/chk_test_123',
        order: {
          status: 'PENDING',
          quotaAmount: '100000',
          amountCents: 1250,
          currency: 'usd',
          stripeSessionId: null,
        },
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);

      const [url, init] = fetchMock.mock.calls[0]!;
      expect(url).toBe('https://test-api.creem.io/v1/checkouts');
      expect(init).toMatchObject({
        method: 'POST',
        headers: {
          'x-api-key': 'creem-secret-key',
          'Content-Type': 'application/json',
        },
      });

      const creemBody = JSON.parse(String(init?.body)) as {
        product_id: string;
        request_id: string;
        success_url: string;
        quantity: number;
        customer: {
          id: string;
          email: string;
        };
        metadata: {
          provider: string;
          productId: string;
          quotaAmount: string;
          amountCents: string;
        };
      };
      expect(creemBody.product_id).toBe('prod_test_100k');
      expect(creemBody.quantity).toBe(1);
      expect(creemBody.customer).toEqual({
        id: user.id,
        email: user.email,
      });
      expect(creemBody.metadata).toMatchObject({
        provider: 'creem',
        productId: 'prod_test_100k',
        quotaAmount: '100000',
        amountCents: '1250',
      });
      expect(creemBody.success_url).toBe(`http://127.0.0.1:3000/console/topup?creem=success&order=${creemBody.request_id}`);

      const order = await prisma.topUpOrder.findUnique({
        where: { id: creemBody.request_id },
      });
      const storedUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { quotaRemaining: true },
      });

      expect(order).toMatchObject({
        userId: user.id,
        provider: 'CREEM',
        status: 'PENDING',
        quotaAmount: 100000n,
        amountCents: 1250,
        currency: 'usd',
        creemCheckoutId: 'chk_test_123',
        creemRequestId: 'creem-request-123',
        creemOrderId: 'creem-order-123',
        creemProductId: 'prod_test_100k',
      });
      expect(storedUser?.quotaRemaining).toBe(25n);
    } finally {
      await closeTestApp(app);
    }
  });

  it('rejects checkout when Creem is disabled or the product is unknown', async () => {
    const user = await createUser();
    const token = await createSessionForUser(user.id);
    const app = await createTestApp();

    try {
      const invalidProductResponse = await app.inject({
        method: 'POST',
        url: '/api/user/topup/creem/checkout',
        cookies: {
          nodew_session: app.signCookie(token),
        },
        payload: {
          productId: 'prod_missing',
        },
      });

      process.env.CREEM_TOPUP_ENABLED = 'false';

      const disabledResponse = await app.inject({
        method: 'POST',
        url: '/api/user/topup/creem/checkout',
        cookies: {
          nodew_session: app.signCookie(token),
        },
        payload: {
          productId: 'prod_test_100k',
        },
      });

      expect(invalidProductResponse.statusCode).toBe(400);
      expect(invalidProductResponse.json().message).toBe('Creem product is not configured');
      expect(disabledResponse.statusCode).toBe(400);
      expect(disabledResponse.json().message).toBe('Creem top-up is not configured');
    } finally {
      await closeTestApp(app);
    }
  });

  it('settles paid Creem webhook events once and ignores duplicate delivery', async () => {
    const user = await createUser({ quotaRemaining: 25n });
    const order = await prisma.topUpOrder.create({
      data: {
        userId: user.id,
        provider: 'CREEM',
        status: 'PENDING',
        quotaAmount: 100000n,
        amountCents: 1250,
        currency: 'usd',
        creemCheckoutId: 'chk_test_123',
        creemRequestId: 'creem-request-123',
        creemProductId: 'prod_test_100k',
      },
    });
    const payload = JSON.stringify({
      id: 'evt_creem_123',
      eventType: 'checkout.completed',
      object: {
        id: 'chk_test_123',
        request_id: order.id,
        order: {
          id: 'creem-order-123',
          amount_paid: 1250,
          currency: 'usd',
          status: 'paid',
          type: 'onetime',
        },
        product: {
          id: 'prod_test_100k',
          name: '100k quota',
        },
      },
    });
    const app = await createTestApp();

    try {
      const firstResponse = await app.inject({
        method: 'POST',
        url: '/api/user/topup/creem/webhook',
        headers: {
          'content-type': 'application/json',
          'creem-signature': signCreemPayload(payload),
        },
        payload,
      });
      const secondResponse = await app.inject({
        method: 'POST',
        url: '/api/user/topup/creem/webhook',
        headers: {
          'content-type': 'application/json',
          'creem-signature': signCreemPayload(payload),
        },
        payload,
      });

      expect(firstResponse.statusCode).toBe(200);
      expect(firstResponse.json()).toMatchObject({
        success: true,
        settled: true,
        orderId: order.id,
      });
      expect(secondResponse.statusCode).toBe(200);
      expect(secondResponse.json()).toMatchObject({
        success: true,
        settled: false,
        orderId: order.id,
      });

      const storedOrder = await prisma.topUpOrder.findUnique({
        where: { id: order.id },
      });
      const storedUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { quotaRemaining: true },
      });

      expect(storedOrder).toMatchObject({
        status: 'PAID',
        creemOrderId: 'creem-order-123',
      });
      expect(storedOrder?.paidAt).not.toBeNull();
      expect(storedUser?.quotaRemaining).toBe(100025n);
    } finally {
      await closeTestApp(app);
    }
  });

  it('rejects invalid Creem webhook signatures and ignores unpaid orders', async () => {
    const user = await createUser({ quotaRemaining: 25n });
    const order = await prisma.topUpOrder.create({
      data: {
        userId: user.id,
        provider: 'CREEM',
        status: 'PENDING',
        quotaAmount: 100000n,
        amountCents: 1250,
        currency: 'usd',
        creemCheckoutId: 'chk_test_unpaid',
        creemRequestId: 'creem-request-unpaid',
        creemProductId: 'prod_test_100k',
      },
    });
    const payload = JSON.stringify({
      id: 'evt_creem_unpaid',
      eventType: 'checkout.completed',
      object: {
        request_id: order.id,
        order: {
          id: 'creem-order-unpaid',
          status: 'pending',
          type: 'onetime',
        },
      },
    });
    const app = await createTestApp();

    try {
      const badSignatureResponse = await app.inject({
        method: 'POST',
        url: '/api/user/topup/creem/webhook',
        headers: {
          'content-type': 'application/json',
          'creem-signature': 'bad-signature',
        },
        payload,
      });
      const unpaidResponse = await app.inject({
        method: 'POST',
        url: '/api/user/topup/creem/webhook',
        headers: {
          'content-type': 'application/json',
          'creem-signature': signCreemPayload(payload),
        },
        payload,
      });

      expect(badSignatureResponse.statusCode).toBe(400);
      expect(badSignatureResponse.json().message).toBe('Creem webhook signature is invalid');
      expect(unpaidResponse.statusCode).toBe(200);
      expect(unpaidResponse.json()).toMatchObject({
        success: true,
        ignored: true,
        reason: 'order_not_paid',
      });

      const storedOrder = await prisma.topUpOrder.findUnique({
        where: { id: order.id },
      });
      const storedUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { quotaRemaining: true },
      });

      expect(storedOrder?.status).toBe('PENDING');
      expect(storedUser?.quotaRemaining).toBe(25n);
    } finally {
      await closeTestApp(app);
    }
  });

  it('rejects invalid Creem webhook JSON and mismatched paid orders', async () => {
    const user = await createUser({ quotaRemaining: 25n });
    const order = await prisma.topUpOrder.create({
      data: {
        userId: user.id,
        provider: 'CREEM',
        status: 'PENDING',
        quotaAmount: 100000n,
        amountCents: 1250,
        currency: 'usd',
        creemCheckoutId: 'chk_test_mismatch',
        creemRequestId: 'creem-request-mismatch',
        creemProductId: 'prod_test_100k',
      },
    });
    const invalidJsonPayload = '{"eventType":"checkout.completed"';
    const mismatchPayload = JSON.stringify({
      id: 'evt_creem_mismatch',
      eventType: 'checkout.completed',
      object: {
        request_id: order.id,
        order: {
          id: 'creem-order-mismatch',
          amount_paid: 1300,
          currency: 'usd',
          status: 'paid',
          type: 'onetime',
        },
        product: {
          id: 'prod_test_100k',
          name: '100k quota',
        },
      },
    });
    const app = await createTestApp();

    try {
      const invalidJsonResponse = await app.inject({
        method: 'POST',
        url: '/api/user/topup/creem/webhook',
        headers: {
          'content-type': 'application/json',
          'creem-signature': signCreemPayload(invalidJsonPayload),
        },
        payload: invalidJsonPayload,
      });
      const mismatchResponse = await app.inject({
        method: 'POST',
        url: '/api/user/topup/creem/webhook',
        headers: {
          'content-type': 'application/json',
          'creem-signature': signCreemPayload(mismatchPayload),
        },
        payload: mismatchPayload,
      });

      expect(invalidJsonResponse.statusCode).toBe(400);
      expect(invalidJsonResponse.json().message).toBe('Creem webhook body must be valid JSON');
      expect(mismatchResponse.statusCode).toBe(400);
      expect(mismatchResponse.json().message).toBe('Creem top-up amount does not match the pending order');

      const storedOrder = await prisma.topUpOrder.findUnique({
        where: { id: order.id },
      });
      const storedUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { quotaRemaining: true },
      });

      expect(storedOrder?.status).toBe('PENDING');
      expect(storedUser?.quotaRemaining).toBe(25n);
    } finally {
      await closeTestApp(app);
    }
  });
});
