# Testing Guide

The project uses Vitest. `vitest.config.ts` selects the Node environment, loads `test/setup.ts`, and uses a single fork to reduce shared-database interference.

## Test structure

- `test/setup.ts`: test environment and per-test `resetDatabase()`.
- `test/helpers/app.ts`: create and close a test Fastify app.
- `test/helpers/db.ts`: database cleanup in foreign-key order.
- `test/helpers/factories.ts`: user, channel, and API-key factories.
- `test/integration/`: real routes against the test database.
- Root `test/*.test.ts`: pure functions, resources, docs, and configuration.

## Commands

```bash
npm test
npm test -- --run test/integration/oauth.test.ts
npm test -- --run test/i18n.test.ts test/auth-callback-i18n.test.ts
npm run build
npm run build:web
bun run --cwd docs build
```

## TDD cycle

1. Add the smallest failing test under `test/`.
2. Run the focused file and confirm the expected failure.
3. Write the minimum implementation.
4. Re-run the focused test.
5. Run the full suite and both builds.

## Integration-test pattern

```ts
const app = await createTestApp();
try {
  const response = await app.inject({ method: 'GET', url: '/api/...' });
  expect(response.statusCode).toBe(200);
} finally {
  await closeTestApp(app);
}
```

Use `createUser()`, `createApiKey()`, and `createChannel()` instead of manually creating incomplete foreign-key records.

## Database requirements

The default test URL is configured in `test/setup.ts`. PostgreSQL must be reachable. After a migration:

```bash
npm run prisma:generate
npm run prisma:migrate:deploy
```

If a full run occasionally reports a 401 or foreign-key failure but the focused file immediately passes, check for another Vitest/Codex process using the same database and re-run. Do not classify a reproducible regression as noise.

## Complete test file index
| File | Coverage |
| --- | --- |
| `test/auth-callback-i18n.test.ts` | Translation coverage for email and OAuth callback pages. |
| `test/development-docs.test.ts` | Development docs, sidebar, footer, and per-file coverage. |
| `test/docs-file-dates.test.ts` | Git-created/updated documentation dates and filesystem fallback. |
| `test/helpers/app.ts` | Creates and closes test Fastify applications. |
| `test/helpers/db.ts` | Clears the test database in foreign-key order. |
| `test/helpers/factories.ts` | Factories for users, channels, API keys, and related records. |
| `test/helpers/fetch.ts` | Fastify/Prisma integration behavior for fetch.ts. |
| `test/i18n.test.ts` | Global translation keys, page wiring, and language preference. |
| `test/integration/admin-bind-subscription.test.ts` | Fastify/Prisma integration behavior for admin-bind-subscription. |
| `test/integration/admin-groups.test.ts` | Fastify/Prisma integration behavior for admin-groups. |
| `test/integration/admin-options.test.ts` | Fastify/Prisma integration behavior for admin-options. |
| `test/integration/admin-redemptions.test.ts` | Fastify/Prisma integration behavior for admin-redemptions. |
| `test/integration/admin-subscription-plans.test.ts` | Fastify/Prisma integration behavior for admin-subscription-plans. |
| `test/integration/admin-users.test.ts` | Fastify/Prisma integration behavior for admin-users. |
| `test/integration/auth-lifecycle.test.ts` | Fastify/Prisma integration behavior for auth-lifecycle. |
| `test/integration/channels.test.ts` | Fastify/Prisma integration behavior for channels. |
| `test/integration/checkin.test.ts` | Fastify/Prisma integration behavior for checkin. |
| `test/integration/compatibility-routes.test.ts` | Fastify/Prisma integration behavior for compatibility-routes. |
| `test/integration/dashboard-routes.test.ts` | Fastify/Prisma integration behavior for dashboard-routes. |
| `test/integration/oauth.test.ts` | Fastify/Prisma integration behavior for oauth. |
| `test/integration/passkey.test.ts` | Fastify/Prisma integration behavior for passkey. |
| `test/integration/relay-claude.test.ts` | Fastify/Prisma integration behavior for relay-claude. |
| `test/integration/relay-embeddings.test.ts` | Fastify/Prisma integration behavior for relay-embeddings. |
| `test/integration/relay-gemini.test.ts` | Fastify/Prisma integration behavior for relay-gemini. |
| `test/integration/relay-responses.test.ts` | Fastify/Prisma integration behavior for relay-responses. |
| `test/integration/relay-weighted-selection.test.ts` | Fastify/Prisma integration behavior for relay-weighted-selection. |
| `test/integration/relay.test.ts` | Fastify/Prisma integration behavior for relay. |
| `test/integration/storage-config.test.ts` | Fastify/Prisma integration behavior for storage-config. |
| `test/integration/subscription-stripe.test.ts` | Fastify/Prisma integration behavior for subscription-stripe. |
| `test/integration/token-usage.test.ts` | Fastify/Prisma integration behavior for token-usage. |
| `test/integration/topup-creem-config.test.ts` | Fastify/Prisma integration behavior for topup-creem-config. |
| `test/integration/topup-stripe.test.ts` | Fastify/Prisma integration behavior for topup-stripe. |
| `test/integration/topup-waffo-config.test.ts` | Fastify/Prisma integration behavior for topup-waffo-config. |
| `test/integration/twofa.test.ts` | Fastify/Prisma integration behavior for twofa. |
| `test/integration/user-language.test.ts` | Fastify/Prisma integration behavior for user-language. |
| `test/integration/user-redemptions.test.ts` | Fastify/Prisma integration behavior for user-redemptions. |
| `test/mailer.test.ts` | Mail URLs and message templates. |
| `test/settings-loader.test.ts` | Settings-resource partial-failure isolation. |
| `test/settings-sections.test.ts` | Settings domains, URLs, and navigation helpers. |
| `test/setup.ts` | Vitest global environment, database reset, and cleanup. |
| `test/shared-request.test.ts` | One-time async request deduplication, cleanup, and retry. |

## Pre-commit gate

```bash
git diff --check
npm run build
npm run build:web
npm test
bun run --cwd docs build
```

For schema changes, also validate `prisma/mysql/schema.prisma`.
