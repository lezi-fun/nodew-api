# Vercel Deployment

::: warning Experimental
Vercel support is experimental. The Serverless deployment path is under active development and should not be treated as production-ready yet.
:::

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

## Build path

The configured build command is:

```bash
npm run vercel-build
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
