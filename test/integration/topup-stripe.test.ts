import { createHmac } from 'node:crypto';

import { prisma } from '../../src/lib/prisma.js';
import { closeTestApp, createTestApp } from '../helpers/app.js';
import { mockFetchOnce } from '../helpers/fetch.js';
import { createSessionForUser, createUser } from '../helpers/factories.js';

const stripeEnvKeys = [
  'APP_BASE_URL',
  'STRIPE_TOPUP_ENABLED',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_CURRENCY',
  'STRIPE_QUOTA_PER_UNIT',
  'STRIPE_UNIT_AMOUNT_CENTS',
  'STRIPE_MIN_UNITS',
] as const;

const savedEnv = new Map<string, string | undefined>();

const applyStripeTestEnv = () => {
  process.env.APP_BASE_URL = 'http://127.0.0.1:3000';
  process.env.STRIPE_TOPUP_ENABLED = 'true';
  process.env.STRIPE_SECRET_KEY = 'sk_test_123';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_123';
  process.env.STRIPE_CURRENCY = 'usd';
  process.env.STRIPE_QUOTA_PER_UNIT = '1000';
  process.env.STRIPE_UNIT_AMOUNT_CENTS = '250';
  process.env.STRIPE_MIN_UNITS = '2';
};

const signStripePayload = (payload: string, secret = 'whsec_test_123') => {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
  return `t=${timestamp},v1=${signature}`;
};

beforeEach(() => {
  savedEnv.clear();

  for (const key of stripeEnvKeys) {
    savedEnv.set(key, process.env[key]);
  }

  applyStripeTestEnv();
});

afterEach(() => {
  for (const key of stripeEnvKeys) {
    const value = savedEnv.get(key);

    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

describe('Stripe top-up integration', () => {
  it('returns the current top-up configuration for signed-in users', async () => {
    const user = await createUser();
    const token = await createSessionForUser(user.id);
    const app = await createTestApp();

    try {
      const response = await app.inject({
        method: 'GET',
        url: '/api/user/topup/stripe/config',
        cookies: {
          nodew_session: app.signCookie(token),
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().item).toMatchObject({
        enabled: true,
        configured: true,
        currency: 'usd',
        quotaPerUnit: 1000,
        unitAmountCents: 250,
        minUnits: 2,
      });
    } finally {
      await closeTestApp(app);
    }
  });

  it('creates a Checkout Session and stores a pending top-up order', async () => {
    const user = await createUser({ quotaRemaining: 25n });
    const token = await createSessionForUser(user.id);
    const fetchMock = mockFetchOnce({
      body: {
        id: 'cs_test_123',
        url: 'https://checkout.stripe.test/session',
        payment_intent: null,
      },
    });
    const app = await createTestApp();

    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/user/topup/stripe/checkout',
        cookies: {
          nodew_session: app.signCookie(token),
        },
        payload: {
          units: 3,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        success: true,
        checkoutUrl: 'https://checkout.stripe.test/session',
        order: {
          status: 'PENDING',
          quotaAmount: '3000',
          amountCents: 750,
          currency: 'usd',
          stripeSessionId: 'cs_test_123',
        },
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);

      const [url, init] = fetchMock.mock.calls[0]!;
      expect(url).toBe('https://api.stripe.com/v1/checkout/sessions');
      expect(init).toMatchObject({
        method: 'POST',
        headers: {
          Authorization: 'Bearer sk_test_123',
          'Content-Type': 'application/x-www-form-urlencoded',
          'Stripe-Version': '2026-02-25.clover',
        },
      });

      const stripeBody = new URLSearchParams(String(init?.body));
      const orderId = stripeBody.get('metadata[orderId]');
      expect(orderId).toBeTruthy();
      expect(stripeBody.get('mode')).toBe('payment');
      expect(stripeBody.get('client_reference_id')).toBe(orderId);
      expect(stripeBody.get('metadata[userId]')).toBe(user.id);
      expect(stripeBody.get('metadata[quotaAmount]')).toBe('3000');
      expect(stripeBody.get('line_items[0][quantity]')).toBe('3');
      expect(stripeBody.get('line_items[0][price_data][unit_amount]')).toBe('250');
      expect(stripeBody.get('success_url')).toBe(`http://127.0.0.1:3000/console/topup?stripe=success&order=${orderId}`);
      expect(stripeBody.get('cancel_url')).toBe(`http://127.0.0.1:3000/console/topup?stripe=cancel&order=${orderId}`);

      const order = await prisma.topUpOrder.findUnique({
        where: { id: orderId! },
      });
      const storedUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { quotaRemaining: true },
      });

      expect(order).toMatchObject({
        userId: user.id,
        provider: 'STRIPE',
        status: 'PENDING',
        quotaAmount: 3000n,
        amountCents: 750,
        currency: 'usd',
        stripeSessionId: 'cs_test_123',
      });
      expect(storedUser?.quotaRemaining).toBe(25n);
    } finally {
      await closeTestApp(app);
    }
  });

  it('settles paid webhook events once and ignores duplicate delivery', async () => {
    const user = await createUser({ quotaRemaining: 25n });
    const order = await prisma.topUpOrder.create({
      data: {
        userId: user.id,
        provider: 'STRIPE',
        status: 'PENDING',
        quotaAmount: 3000n,
        amountCents: 750,
        currency: 'usd',
        stripeSessionId: 'cs_test_123',
      },
    });
    const payload = JSON.stringify({
      id: 'evt_test_123',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_123',
          payment_status: 'paid',
          payment_intent: 'pi_test_123',
          metadata: {
            orderId: order.id,
            userId: user.id,
            quotaAmount: '3000',
          },
        },
      },
    });
    const app = await createTestApp();

    try {
      const firstResponse = await app.inject({
        method: 'POST',
        url: '/api/user/topup/stripe/webhook',
        headers: {
          'content-type': 'application/json',
          'stripe-signature': signStripePayload(payload),
        },
        payload,
      });
      const secondResponse = await app.inject({
        method: 'POST',
        url: '/api/user/topup/stripe/webhook',
        headers: {
          'content-type': 'application/json',
          'stripe-signature': signStripePayload(payload),
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
        stripePaymentIntentId: 'pi_test_123',
      });
      expect(storedOrder?.paidAt).not.toBeNull();
      expect(storedUser?.quotaRemaining).toBe(3025n);
    } finally {
      await closeTestApp(app);
    }
  });

  it('rejects checkout when Stripe is disabled or the unit count is too low', async () => {
    const user = await createUser();
    const token = await createSessionForUser(user.id);
    const app = await createTestApp();

    try {
      const tooSmallResponse = await app.inject({
        method: 'POST',
        url: '/api/user/topup/stripe/checkout',
        cookies: {
          nodew_session: app.signCookie(token),
        },
        payload: {
          units: 1,
        },
      });

      process.env.STRIPE_TOPUP_ENABLED = 'false';

      const disabledResponse = await app.inject({
        method: 'POST',
        url: '/api/user/topup/stripe/checkout',
        cookies: {
          nodew_session: app.signCookie(token),
        },
        payload: {
          units: 3,
        },
      });

      expect(tooSmallResponse.statusCode).toBe(400);
      expect(tooSmallResponse.json().message).toBe('Stripe top-up requires at least 2 unit(s)');
      expect(disabledResponse.statusCode).toBe(400);
      expect(disabledResponse.json().message).toBe('Stripe top-up is not configured');
    } finally {
      await closeTestApp(app);
    }
  });
});
