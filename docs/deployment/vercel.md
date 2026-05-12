# Vercel Deployment

::: warning Experimental
Vercel support is experimental. The Serverless deployment path is under active development and should not be treated as production-ready yet. APIs, database schemas, configuration, and deployment behavior may receive breaking changes at any time without prior notice.
:::

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Flezi-fun%2Fnodew-api)

Contributions, testing feedback, and issue reports are welcome.

The main application uses the repository root `vercel.json` to build the Fastify backend and the Vite web console.

## Required environment variables

```bash
NODE_ENV=production
LOG_LEVEL=info
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"
SESSION_SECRET="replace-with-a-long-random-secret"
CHANNEL_SECRET="replace-with-a-long-random-secret"
```

Use a managed PostgreSQL database. A localhost database URL will not work on Vercel.

## Persistent storage

Vercel functions do not provide durable local disk storage. Configure an external S3-compatible bucket when task assets or generated media must be persisted:

```bash
STORAGE_DRIVER=s3
STORAGE_ENDPOINT="https://<account>.r2.cloudflarestorage.com"
STORAGE_REGION="auto"
STORAGE_BUCKET="nodew-api"
STORAGE_ACCESS_KEY_ID="replace-with-access-key"
STORAGE_SECRET_ACCESS_KEY="replace-with-secret-key"
STORAGE_PUBLIC_BASE_URL="https://assets.example.com/"
STORAGE_PREFIX="nodew"
```

Cloudflare R2 is a good fit for Vercel because it has S3-compatible APIs and can be fronted by a custom domain/CDN.
All stored objects are forced under the `nodew/` directory in the bucket.

## Build path

The configured build command is:

```bash
bun run vercel-build
```

That command generates Prisma Client, builds the TypeScript backend, and builds the web console.

## Routing

The Vercel configuration routes these paths to the Fastify function:

- `/api/*`
- `/v1/*`
- `/v1beta/*`
- `/health`
- `/ready`

All other routes serve the built single-page web console.

## Preview

Temporary test deployment:

<https://nodew.lezi.chat>
