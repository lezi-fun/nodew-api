# Wallet Top-Up

Wallet top-up is currently configured with environment variables. The console can show Stripe and Creem entries on `/console/topup` after the corresponding provider is enabled.

## Capability matrix

| Provider | Checkout creation | Automatic quota settlement | Current status |
| --- | --- | --- | --- |
| Stripe | Supported | Supported through signed webhook | Usable for one-time quota purchases. |
| Creem | Supported | Supported through signed webhook | Usable for fixed-product quota purchases. |
| Waffo | Supported | Not implemented yet | Can create hosted checkout orders for fixed products; webhook settlement and the console purchase button are next. |

Do not enable a provider for production billing until the required settlement path is available and tested for your deployment.

## Shared requirements

Set `APP_BASE_URL` to the public console origin, without a trailing path:

```bash
APP_BASE_URL="https://your-domain.example"
```

This value is used to build return URLs such as `/console/topup?stripe=success&order=...`. For Vercel or any reverse-proxied deployment, it must be the externally reachable HTTPS URL, not an internal hostname.

Run migrations before enabling payment entries:

```bash
npm run prisma:generate
npm run prisma:migrate:deploy
```

The Vercel build command already runs Prisma generation and production migrations through `npm run vercel-build`.

## Stripe

Stripe uses hosted Checkout Sessions and settles quota from signed webhook events.

```bash
STRIPE_TOPUP_ENABLED=true
STRIPE_SECRET_KEY="sk_live_xxx"
STRIPE_WEBHOOK_SECRET="whsec_xxx"
STRIPE_CURRENCY="usd"
STRIPE_QUOTA_PER_UNIT=100000
STRIPE_UNIT_AMOUNT_CENTS=100
STRIPE_MIN_UNITS=1
```

### Flow

1. The console calls `GET /api/user/topup/stripe/config`.
2. The user submits a unit count to `POST /api/user/topup/stripe/checkout`.
3. The backend creates a pending `TopUpOrder` and a Stripe Checkout Session.
4. Stripe redirects the user back to `/console/topup`.
5. Stripe sends a webhook to `/api/user/topup/stripe/webhook`.
6. The backend verifies `Stripe-Signature`, marks the order as paid, and increments the user's remaining quota exactly once.

### Webhook events

Configure the Stripe webhook endpoint as:

```text
https://your-domain.example/api/user/topup/stripe/webhook
```

The backend handles:

| Event | Behavior |
| --- | --- |
| `checkout.session.completed` | Credits quota when `payment_status` is `paid`. |
| `checkout.session.async_payment_succeeded` | Credits quota for delayed payment methods. |
| `checkout.session.expired` | Marks the pending order as expired. |
| `checkout.session.async_payment_failed` | Marks the pending order as failed. |

Duplicate paid webhook delivery is idempotent. The order is credited only while it is still pending.

## Creem

Creem uses fixed products. Each product in `CREEM_PRODUCTS` maps a Creem product ID to the quota and display price used by this application.

```bash
CREEM_TOPUP_ENABLED=true
CREEM_API_KEY="creem_xxx"
CREEM_WEBHOOK_SECRET="creem_whsec_xxx"
CREEM_TEST_MODE=false
CREEM_PRODUCTS='[{"productId":"prod_xxx","name":"100k quota","quotaAmount":100000,"amountCents":1000,"currency":"usd"}]'
```

`CREEM_PRODUCTS` accepts these compatible field names:

| Canonical field | Accepted aliases | Description |
| --- | --- | --- |
| `productId` | `product_id` | Creem product ID. |
| `quotaAmount` | `quota` | Quota credited after future settlement. |
| `amountCents` | `priceCents`, decimal `price` | Product amount in the smallest currency unit. |
| `currency` | none | Currency code, default `usd`. |

### Flow

1. The console calls `GET /api/user/topup/creem/config`.
2. The user selects a configured fixed product.
3. The console calls `POST /api/user/topup/creem/checkout` with `{ "productId": "prod_xxx" }`.
4. The backend creates a pending `TopUpOrder` and a Creem Checkout Session.
5. Creem redirects the user back to `/console/topup`.
6. Creem sends a webhook to `/api/user/topup/creem/webhook`.
7. The backend verifies `creem-signature`, marks the order as paid, and increments the user's remaining quota exactly once.

### Webhook events

Configure the Creem webhook endpoint as:

```text
https://your-domain.example/api/user/topup/creem/webhook
```

The backend handles `checkout.completed` events when the order status is `paid`. Non-paid orders and unsupported order types are acknowledged without crediting quota.

Duplicate paid webhook delivery is idempotent. The order is credited only while it is still pending.

Before enabling Creem top-up in production, create the webhook in Creem with the same endpoint, copy the signing secret to `CREEM_WEBHOOK_SECRET`, and send a test event. If the app is behind a proxy, make sure the public URL reaches this API path unchanged because signature verification uses the raw request body.

## Waffo

Waffo currently has the safe configuration surface, fixed product catalog, and hosted checkout order creation. Webhook settlement and the console purchase button are separate follow-up steps.

```bash
WAFFO_TOPUP_ENABLED=true
WAFFO_API_KEY="waffo_xxx"
WAFFO_PRIVATE_KEY="base64_pkcs8_private_key"
WAFFO_WEBHOOK_SECRET="waffo_whsec_xxx"
WAFFO_TEST_MODE=false
WAFFO_PRODUCTS='[{"productId":"prod_xxx","name":"100k quota","quotaAmount":100000,"amountCents":1000,"currency":"usd"}]'
```

`WAFFO_PRODUCTS` accepts the same compatible field names as Creem: `productId` or `product_id`, `quotaAmount` or `quota`, and `amountCents`, `priceCents`, or decimal `price`. The safe catalog is available at `GET /api/user/topup/waffo/config`, and checkout creation is available at `POST /api/user/topup/waffo/checkout`.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Provider shows as unavailable | Confirm the provider enable flag is `true`, `APP_BASE_URL` is set, and the provider secret is present. |
| Stripe checkout creation fails | Check `STRIPE_SECRET_KEY`, currency, unit amount, and whether migrations have run. |
| Stripe payment returns but quota does not change | Check that the Stripe webhook endpoint is configured, reachable, and uses the matching `STRIPE_WEBHOOK_SECRET`. |
| Creem product list is empty | Validate that `CREEM_PRODUCTS` is valid JSON and every item has a product ID, quota, and amount. |
| Creem checkout succeeds but quota does not change | Check that the Creem webhook endpoint is configured, reachable, and uses the matching `CREEM_WEBHOOK_SECRET`. |
| Waffo product list is empty | Validate that `WAFFO_PRODUCTS` is valid JSON and every item has a product ID, quota, and amount. |
| Waffo checkout creation fails | Check `WAFFO_API_KEY`, `WAFFO_PRIVATE_KEY`, product currency/amount, and whether `APP_BASE_URL` is publicly reachable. |

## API summary

| Route | Auth | Purpose |
| --- | --- | --- |
| `GET /api/user/topup/stripe/config` | User session | Read Stripe top-up status. |
| `POST /api/user/topup/stripe/checkout` | User session | Create a Stripe Checkout Session. |
| `POST /api/user/topup/stripe/webhook` | Stripe signature | Settle Stripe payment events. |
| `GET /api/user/topup/creem/config` | User session | Read Creem readiness and fixed products. |
| `POST /api/user/topup/creem/checkout` | User session | Create a Creem Checkout Session for a configured product. |
| `POST /api/user/topup/creem/webhook` | Creem signature | Settle Creem payment events. |
| `GET /api/user/topup/waffo/config` | User session | Read Waffo readiness and fixed products. |
| `POST /api/user/topup/waffo/checkout` | User session | Create a Waffo hosted checkout order for a configured product. |
