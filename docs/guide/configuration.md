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

Email verification and password reset support external delivery through either SMTP or Resend.

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

In development and test environments, tokens are still surfaced in responses so the flow can be completed without an external mail provider.

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
