# Configuration

NodEW-api reads runtime configuration from environment variables.

For payment-specific setup, return URLs, provider flows, and troubleshooting, see [Wallet Top-Up](./wallet-topup.md).

## Core variables

| Variable | Required | Description |
| --- | --- | --- |
| `NODE_ENV` | Yes | `development`, `test`, or `production`. |
| `HOST` | No | Bind address. Use `0.0.0.0` when exposing the service from a container or VM. |
| `PORT` | No | HTTP server port. Defaults depend on the runtime. |
| `DATABASE_URL` | Yes | Prisma database connection string. |
| `SESSION_SECRET` | Yes | Secret used for sessions and authentication state. |
| `CHANNEL_SECRET` | Recommended | Secret material used for channel credential handling. |
| `LOG_LEVEL` | No | Pino log level, for example `info` or `debug`. |

## Account security

Email verification, password reset, and pre-registration verification support external delivery through either SMTP or Resend.

| Variable | Required | Description |
| --- | --- | --- |
| `APP_BASE_URL` | Yes when mail is enabled | Base console URL used to build verification and reset links. |
| `MAIL_PROVIDER` | No | `disabled`, `smtp`, or `resend`. Defaults to `disabled`. |
| `MAIL_FROM` | Yes when mail is enabled | Sender address used for outbound mail. |
| `SMTP_HOST` | Yes for SMTP | SMTP host name. |
| `SMTP_PORT` | Yes for SMTP | SMTP port. |
| `SMTP_SECURE` | No for SMTP | Set `true` for implicit TLS SMTP. |
| `SMTP_USER` | Yes for SMTP | SMTP username. |
| `SMTP_PASS` | Yes for SMTP | SMTP password. |
| `RESEND_API_KEY` | Yes for Resend | Resend API key. |

In development and test environments, tokens and registration verification codes are still surfaced in responses so the flow can be completed without an external mail provider.

These values can be supplied through environment variables, or entered later from the admin settings page. The settings page persists mail configuration in the database, applies it immediately, and still uses environment variables as defaults when a field has not been configured there.

When the admin setting for registration email verification is enabled, mail delivery must also be enabled. The admin settings page exposes current mail status, editable mail fields, and a test-mail action to verify the configuration.

## Third-party login

Third-party login supports GitHub, Discord, LinuxDO, and OIDC. Built-in providers are configured through environment variables; OIDC can also be edited from the admin settings page.

| Variable | Required | Description |
| --- | --- | --- |
| `APP_BASE_URL` | Yes when any third-party login is enabled | Base console URL used to build the OAuth callback path. |
| `GITHUB_OAUTH_CLIENT_ID` | Yes for GitHub login | GitHub OAuth application client ID. |
| `GITHUB_OAUTH_CLIENT_SECRET` | Yes for GitHub login | GitHub OAuth application client secret. |
| `DISCORD_OAUTH_CLIENT_ID` | Yes for Discord login | Discord OAuth application client ID. |
| `DISCORD_OAUTH_CLIENT_SECRET` | Yes for Discord login | Discord OAuth application client secret. |
| `LINUXDO_OAUTH_CLIENT_ID` | Yes for LinuxDO login | LinuxDO OAuth application client ID. |
| `LINUXDO_OAUTH_CLIENT_SECRET` | Yes for LinuxDO login | LinuxDO OAuth application client secret. |
| `OIDC_OAUTH_ENABLED` | No for OIDC login | Explicitly enables or disables OIDC when environment variables are used. Complete OIDC credentials also enable it automatically. |
| `OIDC_OAUTH_WELL_KNOWN_URL` | No for OIDC login | OIDC discovery document URL. The admin settings page can use it to fetch endpoints. |
| `OIDC_OAUTH_CLIENT_ID` | Yes for OIDC login | OIDC client ID. |
| `OIDC_OAUTH_CLIENT_SECRET` | Yes for OIDC login | OIDC client secret. |
| `OIDC_OAUTH_AUTHORIZATION_URL` | Yes for OIDC login | OIDC authorization endpoint. |
| `OIDC_OAUTH_TOKEN_URL` | Yes for OIDC login | OIDC token endpoint. |
| `OIDC_OAUTH_USERINFO_URL` | Yes for OIDC login | OIDC userinfo endpoint. |
| `OIDC_OAUTH_SCOPE` | No for OIDC login | Scope sent to the authorization endpoint. Defaults to `openid profile email`. |

Behavior notes:

- The callback paths are `/oauth/github`, `/oauth/discord`, `/oauth/linuxdo`, `/oauth/oidc`, and `/oauth/{slug}` for custom providers under `APP_BASE_URL`.
- `GET /api/oauth/state` creates the signed state cookie and returns the provider authorize URL.
- `GET /api/oauth/:provider` consumes the callback, creates an account when registration is enabled, or binds the identity to the current authenticated session.
- OIDC userinfo must return `sub` and `email`. `preferred_username`, `name`, `picture`, and `email_verified` are used when present.
- Admins can save OIDC credentials and endpoints from the settings page. Saved values override environment defaults and apply without a restart.
- The settings page also stores custom OAuth provider configurations. Custom providers use the configured token auth style, map userinfo fields at runtime, and enforce access policies before login or binding succeeds.
- Custom provider field mappings support dot paths such as `data.user.id` and array indexes such as `groups[0]`.
- Access policies accept either a single condition like `{"field":"groups","operator":"contains","value":"staff"}` or grouped policies with `logic`, `conditions`, and `groups`. Supported operators are `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `in`, `not_in`, `contains`, `not_contains`, `exists`, and `not_exists`.

## Stripe wallet top-up

Stripe wallet top-up is configured through environment variables. It uses Stripe-hosted Checkout Sessions for one-time quota purchases.

| Variable | Required | Description |
| --- | --- | --- |
| `APP_BASE_URL` | Yes when Stripe top-up is enabled | Public console URL used to build Checkout success and cancel URLs. |
| `STRIPE_TOPUP_ENABLED` | No | Enables the wallet Stripe entry when set to `true`. Defaults to `false`. |
| `STRIPE_SECRET_KEY` | Yes when enabled | Stripe secret key used to create Checkout Sessions. |
| `STRIPE_WEBHOOK_SECRET` | Yes for webhook settlement | Stripe webhook signing secret for quota settlement. |
| `STRIPE_CURRENCY` | No | Checkout currency. Defaults to `usd`. |
| `STRIPE_QUOTA_PER_UNIT` | No | Quota credited for each purchased unit. Defaults to `100000`. |
| `STRIPE_UNIT_AMOUNT_CENTS` | No | Price per unit in the smallest currency unit. Defaults to `100`. |
| `STRIPE_MIN_UNITS` | No | Minimum units allowed per top-up. Defaults to `1`. |

Behavior notes:

- The user route `POST /api/user/topup/stripe/checkout` creates a pending top-up order and returns the Checkout URL.
- Configure the Stripe webhook endpoint as `/api/user/topup/stripe/webhook`.
- The backend verifies the webhook signature before parsing the event body.
- Paid webhooks credit quota exactly once, even when Stripe retries the same event.
- Expired or failed Checkout events mark pending orders as no longer payable.

## Creem wallet top-up catalog

Creem wallet top-up uses fixed products created in Creem. Signed-in users can read the safe product catalog, create a Checkout Session for a configured product, and receive quota after signed webhook settlement.

| Variable | Required | Description |
| --- | --- | --- |
| `APP_BASE_URL` | Yes when Creem top-up is enabled | Public console URL used by Creem checkout success redirects. |
| `CREEM_TOPUP_ENABLED` | No | Enables the wallet Creem readiness state when set to `true`. Defaults to `false`. |
| `CREEM_API_KEY` | Yes when enabled | Creem API key used by the checkout creation endpoint. Never returned to clients. |
| `CREEM_WEBHOOK_SECRET` | Yes for webhook settlement | Creem webhook signing secret. Never returned to clients. |
| `CREEM_TEST_MODE` | No | Switches Creem API calls to the test endpoint. Defaults to `false`. |
| `CREEM_PRODUCTS` | Yes when enabled | JSON array of fixed products, for example `[{"productId":"prod_xxx","name":"100k quota","quotaAmount":100000,"amountCents":1000,"currency":"usd"}]`. |

Behavior notes:

- `GET /api/user/topup/creem/config` returns only non-sensitive configuration status and normalized products.
- `POST /api/user/topup/creem/checkout` accepts `{ "productId": string }`, creates a pending top-up order for the configured product, and returns the Creem Checkout URL.
- Configure the Creem webhook endpoint as `/api/user/topup/creem/webhook`.
- Paid Creem webhooks credit quota exactly once, even when Creem retries the same event.
- Product entries accept `productId` or `product_id`, `quotaAmount` or `quota`, and either `amountCents`, `priceCents`, or decimal `price`.
- Invalid product JSON is treated as an empty catalog, so Creem top-up is not reported as configured.

## Daily check-in

Daily check-in settings are stored in system options rather than environment variables.

| Option key | Description |
| --- | --- |
| `checkin_enabled` | Enables or disables the check-in entry on the personal page. |
| `checkin_min_quota` | Minimum quota awarded by a successful daily check-in. |
| `checkin_max_quota` | Maximum quota awarded by a successful daily check-in. |

Behavior notes:

- When `checkin_enabled` is `false`, the personal page hides the check-in entry.
- Each successful check-in awards a random quota value between `checkin_min_quota` and `checkin_max_quota`.
- The personal page shows check-in status, month history, total history, current streak, and longest streak.
- Legacy deployments that still only have `checkin_reward_quota` stored are read as a fallback until the new min/max settings are saved.

## Passkey

Passkey settings are also stored in system options and can be edited from the admin settings page.

| Option key | Description |
| --- | --- |
| `passkey_enabled` | Enables or disables Passkey registration and login. |
| `passkey_rp_display_name` | WebAuthn RP display name shown during registration. |
| `passkey_rp_id` | WebAuthn RP ID (usually the root domain). Leave empty to auto-resolve. |
| `passkey_origins` | Allowed WebAuthn origins (comma or newline separated). Leave empty to auto-resolve from request origin. |
| `passkey_allow_insecure_origin` | Allows `http://` origins. Recommended only for development. |
| `passkey_user_verification` | User verification requirement: `preferred`, `required`, or `discouraged`. |
| `passkey_attachment_preference` | Authenticator preference: empty, `platform`, or `cross-platform`. |

## Secure verification window

High-risk personal security actions use a shared verification window instead of trusting the page state alone.

- `POST /api/verify` accepts either a 2FA code / backup code or a Passkey verification result.
- After verification succeeds, the server issues a short-lived signed cookie.
- `POST /api/user/2fa/disable`, `POST /api/user/2fa/backup-codes`, and `DELETE /api/user/passkey` require that cookie.
- Direct requests without a fresh verification state are rejected with `403`.

## Object storage

Object storage is optional and disabled by default. Enable it when generated images, videos, task files, or future upload assets must survive Serverless function restarts.

| Variable | Required when enabled | Description |
| --- | --- | --- |
| `STORAGE_DRIVER` | Yes | `disabled` or `s3`. |
| `STORAGE_ENDPOINT` | Yes | S3-compatible endpoint, for example AWS S3, Cloudflare R2, MinIO, or Tencent COS S3. |
| `STORAGE_REGION` | No | Region used for request signing. Use `auto` for Cloudflare R2. |
| `STORAGE_BUCKET` | Yes | Bucket name. |
| `STORAGE_ACCESS_KEY_ID` | Yes | Access key ID. |
| `STORAGE_SECRET_ACCESS_KEY` | Yes | Secret access key. |
| `STORAGE_PUBLIC_BASE_URL` | No | Public CDN or bucket URL used when returning stored object URLs. |
| `STORAGE_FORCE_PATH_STYLE` | No | Set `true` for MinIO and endpoints that require path-style URLs. |
| `STORAGE_PREFIX` | No | Object key prefix. Defaults to `nodew`; every stored object is forced under the `nodew/` directory. |

The backend exposes `GET /api/storage/status` for administrators. It returns only non-sensitive storage status and never returns access keys.

## Production guidance

Use long random values for `SESSION_SECRET` and `CHANNEL_SECRET`. Do not reuse development secrets in production-like environments.

For Vercel and other Serverless targets, use an external managed PostgreSQL database. Localhost database URLs cannot work from hosted functions.

## Development account

Development mode upserts this administrator account:

```text
test@test.com / testtest
```

The seed path is non-destructive and does not wipe channels, tokens, users, or logs.
