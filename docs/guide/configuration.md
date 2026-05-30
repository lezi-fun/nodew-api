# Configuration

NodEW-api reads runtime configuration from environment variables.

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
