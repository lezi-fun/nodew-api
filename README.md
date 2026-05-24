# NodEW-api

[![GitHub repo](https://img.shields.io/badge/GitHub-lezi--fun%2Fnodew--api-181717?logo=github)](https://github.com/lezi-fun/nodew-api)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](./LICENSE)
![Node.js](https://img.shields.io/badge/Node.js-%3E%3D22-339933?logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)
![Fastify](https://img.shields.io/badge/Fastify-5.x-000000?logo=fastify&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-6.x-2D3748?logo=prisma&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=111111)
![Vite](https://img.shields.io/badge/Vite-6.x-646CFF?logo=vite&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-default-4169E1?logo=postgresql&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-supported-4479A1?logo=mysql&logoColor=white)
![OpenAI compatible](https://img.shields.io/badge/OpenAI-compatible-412991?logo=openai&logoColor=white)
![One API](https://img.shields.io/badge/One%20API-Node.js%20edition-10B981)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Flezi-fun%2Fnodew-api)

Languages: [English](./README.md) | [简体中文](./README.zh-CN.md)

Preview: <https://nodew.lezi.chat>

> The preview link points to a temporary test deployment for trying the current UI and API flow. It is not a production service.

NodEW-api is a Node.js and TypeScript edition of the One API gateway, focused on OpenAI-compatible relay, multi-provider channel routing, token management, usage logging, and web-based administration.

Repository: <https://github.com/lezi-fun/nodew-api>

Based on One API: <https://github.com/songquanpeng/one-api>

Copyright 2026 lezi-fun Team. Licensed under the Apache License, Version 2.0.

## Status

> NodEW-api is still in early-stage development. It is not recommended for production use yet. APIs, database schemas, configuration, and deployment behavior may receive breaking changes at any time without prior notice. Contributions, testing feedback, and issue reports are welcome.

Serverless deployment support is under active development.

This project is a Node.js/TypeScript adaptation of One API. The codebase is built around Fastify, Prisma, TypeScript, React, Vite, and Semi UI.

Current capabilities include:

- OpenAI-compatible relay endpoints under `/v1`, including chat completions and streaming responses.
- Channel management with provider metadata, weights, priorities, health checks, and model sync.
- Token management with quota, expiry, and model allow/block metadata.
- Account security flows, including email verification, password reset, and session management.
- Usage logs and billing-oriented request accounting.
- Admin console for dashboard, channels, tokens, users, redemptions, logs, models, deployment, settings, wallet, and playground.
- PostgreSQL by default, with a dedicated MySQL Prisma schema for MySQL deployments.

## Requirements

- Node.js 22 or newer
- npm
- PostgreSQL for the default setup
- Optional: MySQL if using the MySQL Prisma schema

## Quick Start

> Early-stage warning: NodEW-api is not recommended for production use yet. APIs, database schemas, configuration, and deployment behavior may receive breaking changes at any time without prior notice.

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

Email delivery now supports either SMTP or Resend. Configure one provider when you want password reset, email verification, and pre-registration verification messages to be sent automatically.

```bash
APP_BASE_URL="http://127.0.0.1:3000"
MAIL_PROVIDER="smtp"
MAIL_FROM="noreply@example.com"
SMTP_HOST="smtp.example.com"
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER="smtp-user"
SMTP_PASS="smtp-password"
```

Or use Resend:

```bash
APP_BASE_URL="http://127.0.0.1:3000"
MAIL_PROVIDER="resend"
MAIL_FROM="noreply@example.com"
RESEND_API_KEY="re_xxx"
```

If you plan to require email verification before registration from the admin settings page, make sure mail delivery is configured first. When this option is enabled:

- Users must open the verification link from the email or enter the verification code on the registration page.
- The account is created only after verification succeeds.
- The settings page shows current mail delivery status and includes a test-mail action.

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

## Vercel Deployment

Vercel support is experimental while the Serverless deployment path is under active development.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Flezi-fun%2Fnodew-api)

The repository includes:

- `vercel.json`: build, function, and rewrite configuration.
- `api/server.js`: Vercel Function entrypoint for the compiled Fastify app.
- `installCommand`: uses Bun to install both root backend dependencies and `web` frontend dependencies.
- `bun run vercel-build`: generates Prisma Client, builds the backend, and builds the web console.

Required Vercel environment variables:

```bash
NODE_ENV=production
LOG_LEVEL=info
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"
SESSION_SECRET="replace-with-a-long-random-secret"
CHANNEL_SECRET="replace-with-a-long-random-secret"
```

Use an external PostgreSQL provider such as Neon, Supabase, RDS, Railway, or another managed database. Do not use a localhost database on Vercel.

Run migrations against the production database before deploying:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public" npm run prisma:migrate:deploy
```

Vercel routes `/api/*`, `/v1/*`, `/v1beta/*`, `/health`, and `/ready` to the Fastify function. Other paths are served by the built SPA from `web/dist`.

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
