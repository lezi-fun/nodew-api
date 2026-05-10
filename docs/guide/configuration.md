# Configuration

nodew-api reads runtime configuration from environment variables.

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

## Production guidance

Use long random values for `SESSION_SECRET` and `CHANNEL_SECRET`. Do not reuse development secrets in production-like environments.

For Vercel and other Serverless targets, use an external managed PostgreSQL database. Localhost database URLs cannot work from hosted functions.

## Development account

Development mode upserts this administrator account:

```text
test@test.com / testtest
```

The seed path is non-destructive and does not wipe channels, tokens, users, or logs.
