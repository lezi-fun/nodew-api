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
  process.env.STRIPE_MIN_UNITS = '1';
};

const signStripePayload = (payload: string, secret = 'whsec_test_123') => {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
  return `t=${timestamp},v1=${signature}`;
};

const createPlanConfig = () => JSON.stringify([
  {
    id: 'monthly-basic',
    title: '基础版',
    subtitle: '适合轻量使用',
    description: '按月提供固定额度与基础权益',
    badge: '热门',
    priceAmount: 29.9,
    currency: 'CNY',
    quota: '每月 500,000 额度',
    quotaAmount: 500000,
    duration: '30 天',
    durationDays: 30,
    features: ['基础模型访问', '标准优先级'],
    enabled: true,
    sortOrder: 100,
  },
]);

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

describe('subscription stripe integration', () => {
  it('creates a Stripe Checkout Session for a configured subscription plan', async () => {
    const user = await createUser({ quotaRemaining: 25n });
    const token = await createSessionForUser(user.id);
    await prisma.systemOption.create({
      data: {
        key: 'subscription_plans',
        value: createPlanConfig(),
      },
    });
    const fetchMock = mockFetchOnce({
      body: {
        id: 'cs_test_subscription_123',
        url: 'https://checkout.stripe.test/subscription',
        payment_intent: null,
      },
    });
    const app = await createTestApp();

    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/subscription/stripe/checkout',
        cookies: {
          nodew_session: app.signCookie(token),
        },
        payload: {
          planId: 'monthly-basic',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        success: true,
        checkoutUrl: 'https://checkout.stripe.test/subscription',
        order: {
          status: 'PENDING',
          quotaAmount: '500000',
          amountCents: 2990,
          currency: 'cny',
          stripeSessionId: 'cs_test_subscription_123',
        },
      });

      const [url, init] = fetchMock.mock.calls[0]!;
      expect(url).toBe('https://api.stripe.com/v1/checkout/sessions');
      const body = new URLSearchParams(String(init?.body));
      expect(body.get('line_items[0][quantity]')).toBe('1');
      expect(body.get('line_items[0][price_data][unit_amount]')).toBe('2990');
      expect(body.get('line_items[0][price_data][product_data][name]')).toBe('基础版');
      expect(body.get('metadata[kind]')).toBe('subscription');
      expect(body.get('metadata[planId]')).toBe('monthly-basic');
    } finally {
      await closeTestApp(app);
    }
  });

  it('activates a subscription from Stripe webhook and exposes it through self route', async () => {
    const user = await createUser({ quotaRemaining: 25n });
    const token = await createSessionForUser(user.id);
    const order = await prisma.topUpOrder.create({
      data: {
        userId: user.id,
        provider: 'STRIPE',
        status: 'PENDING',
        quotaAmount: 500000n,
        amountCents: 2990,
        currency: 'cny',
        stripeSessionId: 'cs_test_subscription_123',
        metadata: {
          kind: 'subscription',
          planId: 'monthly-basic',
          planTitle: '基础版',
          planSubtitle: '适合轻量使用',
          badge: '热门',
          description: '按月提供固定额度与基础权益',
          quota: '每月 500,000 额度',
          quotaAmount: 500000,
          duration: '30 天',
          durationDays: 30,
          features: ['基础模型访问', '标准优先级'],
        },
      },
    });
    const payload = JSON.stringify({
      id: 'evt_test_subscription_123',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_subscription_123',
          payment_status: 'paid',
          payment_intent: 'pi_test_subscription_123',
          metadata: {
            orderId: order.id,
            userId: user.id,
            quotaAmount: '500000',
            kind: 'subscription',
            planId: 'monthly-basic',
          },
        },
      },
    });
    const app = await createTestApp();

    try {
      const webhookResponse = await app.inject({
        method: 'POST',
        url: '/api/user/topup/stripe/webhook',
        headers: {
          'content-type': 'application/json',
          'stripe-signature': signStripePayload(payload),
        },
        payload,
      });

      expect(webhookResponse.statusCode).toBe(200);
      expect(webhookResponse.json()).toMatchObject({
        success: true,
        settled: true,
        orderId: order.id,
      });

      const selfResponse = await app.inject({
        method: 'GET',
        url: '/api/subscription/self',
        cookies: {
          nodew_session: app.signCookie(token),
        },
      });

      expect(selfResponse.statusCode).toBe(200);
      expect(selfResponse.json().items).toEqual([
        expect.objectContaining({
          id: order.id,
          planId: 'monthly-basic',
          title: '基础版',
          status: 'ACTIVE',
        }),
      ]);

      const storedUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { quotaRemaining: true, settings: true },
      });

      expect(storedUser?.quotaRemaining).toBe(500025n);
      expect(storedUser?.settings).toMatchObject({
        subscriptions: [
          expect.objectContaining({
            id: order.id,
            planId: 'monthly-basic',
            title: '基础版',
          }),
        ],
      });
    } finally {
      await closeTestApp(app);
    }
  });
});
