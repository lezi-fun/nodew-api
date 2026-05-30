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

Optional mail delivery for password reset, email verification, and pre-registration verification:

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

You can keep these values in environment variables, or fill them later from the admin settings page. The admin settings page stores mail configuration in the database and applies it immediately.

If you want users to verify their email before an account is created, enable the registration verification switch from the admin settings page after mail delivery is working. The settings page also includes mail configuration fields, a mail-status panel, and a test-mail action.

The admin settings page also includes a dedicated daily check-in section. There you can:

- enable or disable the personal-page check-in entry,
- set the minimum random reward quota,
- set the maximum random reward quota.

After signing in, users can open the personal page to view daily check-in status, monthly history, cumulative totals, and streak statistics.

The same settings page includes a Passkey section. You can enable Passkey login and adjust RP/origin/user-verification parameters before users register Passkeys from the personal page or use Passkey login on the sign-in page.

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
