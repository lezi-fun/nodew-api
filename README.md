# nodew-api

nodew-api is an independent Node.js and TypeScript LLM gateway for OpenAI-compatible relay, multi-provider channel routing, token management, usage logging, and web-based administration.

Repository: <https://github.com/lezi-fun/nodew-api>

Copyright 2026 nodew-api Team. Licensed under the Apache License, Version 2.0.

## Status

This project is a clean-room Node.js implementation of a modern large-model gateway. It is not a modified Go project. The codebase is built around Fastify, Prisma, TypeScript, React, Vite, and Semi UI.

Current capabilities include:

- OpenAI-compatible relay endpoints under `/v1`, including chat completions and streaming responses.
- Channel management with provider metadata, weights, priorities, health checks, and model sync.
- Token management with quota, expiry, and model allow/block metadata.
- Usage logs and billing-oriented request accounting.
- Admin console for dashboard, channels, tokens, users, redemptions, logs, models, deployment, settings, wallet, and playground.
- PostgreSQL by default, with a dedicated MySQL Prisma schema for MySQL deployments.

## Requirements

- Node.js 22 or newer
- npm
- PostgreSQL for the default setup
- Optional: MySQL if using the MySQL Prisma schema

## Quick Start

Install dependencies:

```bash
npm install
cd web
npm install
cd ..
```

Create `.env`:

```bash
NODE_ENV=development
HOST=0.0.0.0
PORT=3000
LOG_LEVEL=info
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/nodew_api?schema=public"
SESSION_SECRET="nodew-dev-session-secret"
```

Prepare Prisma:

```bash
npm run prisma:generate
npm run prisma:migrate:deploy
```

Build the web console:

```bash
cd web
npm run build
cd ..
```

Start the server:

```bash
npm run dev
```

Open `http://127.0.0.1:3000`.

In development, the server automatically ensures this admin account exists:

```text
Email: test@test.com
Password: testtest
```

The development seed is non-destructive: it upserts the default admin and setup state without deleting channels, tokens, users, or logs.

## Production Build

```bash
cd web
npm run build
cd ..
npm run build
npm run start
```

`npm run start` serves the compiled backend and the built frontend from `web/dist` on the configured `HOST` and `PORT`.

## Database Providers

PostgreSQL is the default provider:

```bash
npm run prisma:generate:postgres
npm run prisma:migrate:deploy:postgres
```

MySQL is supported through a dedicated schema:

```bash
export DATABASE_URL="mysql://nodew_api:nodew_api@localhost:3306/nodew_api"
npm run prisma:generate:mysql
npm run prisma:migrate:deploy:mysql
```

Only one Prisma provider is active in a built deployment. Regenerate the Prisma Client after switching providers.

## Common Commands

```bash
npm run dev
npm run build
npm run start
npm test
```

Web console commands:

```bash
cd web
npm run dev
npm run build
npm run preview
```

## API Overview

Relay endpoints:

- `GET /v1/models`
- `POST /v1/chat/completions`
- `POST /v1/completions`
- `POST /v1/embeddings`
- `POST /v1/responses`
- `POST /v1/images/generations`
- `POST /v1/audio/speech`
- `POST /v1/audio/transcriptions`
- `POST /v1/audio/translations`

Admin and console APIs are exposed under `/api`.

## License

Apache License 2.0. See [LICENSE](./LICENSE).
