# Getting Started

NodEW-api is a Node.js and TypeScript adaptation of [One API](https://github.com/songquanpeng/one-api). It provides an OpenAI-compatible relay service, a database-backed channel system, token management, usage logs, and a web admin console.

::: warning Early development
The project is still in early-stage development. Do not use it for production workloads yet. APIs, database schemas, configuration, and deployment behavior may receive breaking changes at any time without prior notice.
:::

## Requirements

- Node.js 22 or newer
- npm
- PostgreSQL for the default setup
- Optional: MySQL when using the MySQL Prisma schema

## Install

```bash
npm install
cd web
npm install
cd ..
```

## Environment

Create `.env` in the repository root:

```bash
NODE_ENV=development
HOST=0.0.0.0
PORT=3000
LOG_LEVEL=info
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/nodew_api?schema=public"
SESSION_SECRET="nodew-dev-session-secret"
CHANNEL_SECRET="nodew-dev-channel-secret"
```

## Database

```bash
npm run prisma:generate
npm run prisma:migrate:deploy
```

## Run

```bash
npm run dev
```

Open `http://127.0.0.1:3000`.

In development, the server ensures the following admin user exists without clearing existing data:

```text
Email: test@test.com
Password: testtest
```

## Build

```bash
cd web
npm run build
cd ..
npm run build
npm run start
```
