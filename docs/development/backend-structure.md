# Backend Structure

The backend follows a simple rule: route modules own HTTP protocol and orchestration; `src/lib/` owns reusable domain logic.

## Bootstrap and infrastructure

| File | Responsibility |
| --- | --- |
| `src/server.ts` | Process entry; calls `startApp()` |
| `src/app.ts` | Creates Fastify and registers middleware, static files, and routes |
| `src/config/env.ts` | Environment schema, defaults, and parsing |
| `src/lib/prisma.ts` | Prisma Client singleton |
| `src/plugins/auth.ts` | Session/API-key/admin pre-handlers |
| `src/bootstrap/dev-seed.ts` | Development admin and seed records |

## Authentication and accounts

| Feature | Implementation | Tests |
| --- | --- | --- |
| Registration, login, 2FA, Passkey | `src/modules/auth/routes.ts` | `auth-lifecycle.test.ts`, `twofa.test.ts`, `passkey.test.ts` |
| Email verification | `src/modules/auth/email-verification.ts` | `auth-lifecycle.test.ts` |
| Pre-registration verification | `pending-registration.ts`, `registration.ts` | `auth-lifecycle.test.ts` |
| Email changes | `src/modules/auth/email-binding.ts` | `auth-lifecycle.test.ts` |
| Password reset | `src/modules/auth/password-reset.ts` | `auth-lifecycle.test.ts` |
| Current user | `src/modules/self/routes.ts` | `user-language.test.ts` and related tests |
| TOTP helpers | `src/lib/totp.ts` | `twofa.test.ts` |
| Passkey helpers | `src/lib/passkey.ts` | `passkey.test.ts` |

## OAuth

- `src/modules/oauth/routes.ts`: state, callback, login, and binding endpoints.
- `src/lib/oauth.ts`: provider requests and normalized identity data.
- `src/lib/oauth-config.ts`: GitHub, OIDC, and custom-provider settings.
- `src/lib/oauth-access-policy.ts`: access-policy evaluation.
- `test/integration/oauth.test.ts`: login, binding, 2FA, redirects, and errors.

OAuth changes usually also touch `web/src/pages/Login.tsx`, `OAuthCallback.tsx`, and `web/src/lib/oauth.tsx`.

## Relay subsystem

| File | Responsibility |
| --- | --- |
| `src/modules/relay/routes.ts` | `/v1` and `/v1beta` HTTP entry |
| `service.ts` / `executor.ts` | Execution and generic retry |
| `model-routing.ts` | Candidate channels for a model |
| `channel-selector.ts` / `balancer.ts` | Weighted and health-aware selection |
| `channel-health.ts` | Failure, cooldown, and recovery state |
| `billing.ts` | Token and quota accounting |
| `openai-*` | OpenAI chat adapter/service |
| `responses-*` | Responses API |
| `claude-*` | Anthropic Messages |
| `gemini-*` | Gemini and OpenAI-compatible conversion |
| `embeddings-service.ts` | Embeddings |
| `media-storage.ts` / `multipart.ts` | Files and multimodal payloads |

Tests: `relay.test.ts`, `relay-responses.test.ts`, `relay-claude.test.ts`, `relay-gemini.test.ts`, `relay-embeddings.test.ts`, and `relay-weighted-selection.test.ts`.

## Business modules

- Channels: `src/modules/channels/routes.ts`.
- API keys: `src/modules/api-keys/routes.ts`.
- Usage: `src/modules/usage/routes.ts`.
- Dashboard: `src/modules/dashboard/routes.ts`.
- Check-in: `src/modules/checkin/routes.ts`.
- Top-up: `src/modules/billing/routes.ts`; providers are in `src/lib/stripe.ts`, `creem.ts`, and `waffo.ts`.
- Subscription: `src/modules/subscription/routes.ts`, `subscription-plans.ts`, and `user-subscriptions.ts`.
- Admin APIs: `src/modules/admin/*/routes.ts`.
- Object storage: `src/modules/admin/storage/routes.ts` and `src/lib/object-storage.ts`.

## Complete backend file index
| File | Responsibility |
| --- | --- |
| `src/app.ts` | Creates Fastify, registers plugins/routes, serves the SPA, and exposes health checks. |
| `src/bootstrap/dev-seed.ts` | Ensures the development admin, setup state, and default options exist. |
| `src/config/env.ts` | Defines and parses runtime environment variables with Zod. |
| `src/lib/creem.ts` | Creem product configuration, checkout, and webhook verification. |
| `src/lib/crypto.ts` | Generates, hashes, verifies, and encrypts passwords, keys, codes, and channel secrets. |
| `src/lib/mail-config.ts` | Merges environment/database mail settings and validates runtime configuration. |
| `src/lib/mailer.ts` | SMTP/Resend delivery and verification/binding/registration/reset templates. |
| `src/lib/oauth-access-policy.ts` | Parses and evaluates custom OAuth access policies. |
| `src/lib/oauth-config.ts` | Loads runtime configuration for built-in and custom OAuth providers. |
| `src/lib/oauth.ts` | OAuth state cookies, built-in provider primitives, and types. |
| `src/lib/object-storage.ts` | S3-compatible signing, upload, deletion, and public URLs. |
| `src/lib/passkey.ts` | Passkey settings, secure-verification cookies, and WebAuthn helpers. |
| `src/lib/prisma.ts` | Prisma Client singleton with development hot-reload reuse. |
| `src/lib/stripe.ts` | Stripe checkout configuration, session creation, and webhook signatures. |
| `src/lib/subscription-plans.ts` | Reads, sorts, and manages subscription plans stored in system options. |
| `src/lib/totp.ts` | TOTP secrets/codes, otpauth URIs, and backup codes. |
| `src/lib/user-subscriptions.ts` | Normalizes, appends, and evaluates subscription records in user settings. |
| `src/lib/waffo.ts` | Waffo product configuration, RSA signing, checkout, and webhook verification. |
| `src/modules/admin/groups/routes.ts` | User-group CRUD. |
| `src/modules/admin/options/routes.ts` | System option, mail, OAuth, and test-mail configuration APIs. |
| `src/modules/admin/redemptions/routes.ts` | Redemption-code creation, updates, deletion, and administration. |
| `src/modules/admin/storage/routes.ts` | Object-storage configuration and status. |
| `src/modules/admin/users/routes.ts` | Admin user CRUD, quota, group, OAuth, 2FA, and Passkey management. |
| `src/modules/api-keys/routes.ts` | Creates, lists, updates, and deletes user API keys. |
| `src/modules/auth/email-binding.ts` | Requests and verifies new-email tokens/codes. |
| `src/modules/auth/email-verification.ts` | Account email-verification token lifecycle. |
| `src/modules/auth/password-reset.ts` | Issues/verifies password-reset tokens and invalidates sessions. |
| `src/modules/auth/pending-registration.ts` | Creates, reads, and deletes pre-registration verification records. |
| `src/modules/auth/registration.ts` | Registration policy and identity-availability checks. |
| `src/modules/auth/routes.ts` | Main registration, login, 2FA, Passkey, email, and password routes. |
| `src/modules/auth/twofa-login-challenge.ts` | Sets, reads, and clears 2FA login challenge cookies. |
| `src/modules/billing/routes.ts` | Public pricing, top-up settings, checkout, orders, and webhooks. |
| `src/modules/channels/routes.ts` | Channel CRUD, batch operations, connection tests, and model discovery. |
| `src/modules/checkin/routes.ts` | Daily check-in, random rewards, calendar, and streak statistics. |
| `src/modules/compatibility/routes.ts` | Compatibility endpoints for legacy One API/frontend contracts. |
| `src/modules/dashboard/routes.ts` | Aggregates console metrics and recent activity. |
| `src/modules/oauth/routes.ts` | OAuth state, callback, login, and account-binding APIs. |
| `src/modules/relay/balancer.ts` | Smooth weighted balancing and persisted selection state. |
| `src/modules/relay/billing.ts` | Usage extraction, pricing ratios, quota deduction, and logs. |
| `src/modules/relay/channel-health.ts` | Failure counts, cooldown, disablement, and recovery. |
| `src/modules/relay/channel-selector.ts` | Selects channels by weight and health. |
| `src/modules/relay/claude-adapter.ts` | Converts between internal/OpenAI and Claude Messages formats. |
| `src/modules/relay/claude-service.ts` | Anthropic Messages requests, streams, and usage. |
| `src/modules/relay/embeddings-service.ts` | Embeddings forwarding and billing. |
| `src/modules/relay/executor.ts` | Executes candidates, retries, and manages streaming lifecycle. |
| `src/modules/relay/gemini-adapter.ts` | Gemini-native request/response conversion. |
| `src/modules/relay/gemini-openai-adapter.ts` | Converts Gemini and OpenAI chat formats. |
| `src/modules/relay/gemini-service.ts` | Forwards Gemini generateContent/streamGenerateContent. |
| `src/modules/relay/media-storage.ts` | Persists relay-generated media to object storage. |
| `src/modules/relay/model-routing.ts` | Model matching, group ratios, and candidate generation. |
| `src/modules/relay/multipart.ts` | Parses and rebuilds multipart/form-data. |
| `src/modules/relay/openai-adapter.ts` | Normalizes OpenAI requests and responses. |
| `src/modules/relay/openai-service.ts` | Forwards to OpenAI-compatible upstreams. |
| `src/modules/relay/providers.ts` | Provider default URLs, headers, and capabilities. |
| `src/modules/relay/rate-limit.ts` | In-memory request rate limiting. |
| `src/modules/relay/responses-service.ts` | Forwards OpenAI Responses API and extracts usage. |
| `src/modules/relay/routes.ts` | OpenAI/Claude/Gemini-compatible relay HTTP entry. |
| `src/modules/relay/service.ts` | General Chat Completions service. |
| `src/modules/relay/types.ts` | Shared relay channel, request, execution, and billing types. |
| `src/modules/self/routes.ts` | Current-user profile, language, password, 2FA, Passkey, and OAuth binding APIs. |
| `src/modules/setup/routes.ts` | Setup status and first-administrator API. |
| `src/modules/status/routes.ts` | Public site status, authentication capabilities, and frontend bootstrap data. |
| `src/modules/subscription/routes.ts` | Plan listing/purchase, admin plan CRUD, and manual assignment. |
| `src/modules/usage/routes.ts` | Usage-log pagination, summaries, and token-level statistics. |
| `src/plugins/auth.ts` | Session/API-key authentication and user/admin/relay pre-handlers. |
| `src/server.ts` | Process entry that parses environment and starts listening. |

## Database changes

Update all four locations:

```text
prisma/schema.prisma
prisma/mysql/schema.prisma
prisma/migrations/<timestamp>_name/migration.sql
prisma/mysql/migrations/<timestamp>_name/migration.sql
```

Then run:

```bash
npm run prisma:generate
npm run prisma:migrate:dev
DATABASE_URL='mysql://user:pass@localhost:3306/nodew_api' npx prisma validate --schema prisma/mysql/schema.prisma
```

## Testing and debugging

```bash
npm run build
npm test -- --run test/integration/auth-lifecycle.test.ts
npm test -- --run test/integration/relay.test.ts
```

`test/helpers/app.ts` builds Fastify, `test/helpers/factories.ts` creates users/channels/API keys, and `test/setup.ts` resets the database before every test.
