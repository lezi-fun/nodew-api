# Architecture Overview

This page describes the complete path from a browser or SDK request to an upstream model response, and the directories normally touched by a feature.

## Stack

- Backend: Node.js 22, TypeScript, and Fastify. Entry points: `src/server.ts` and `src/app.ts`.
- Data: Prisma. PostgreSQL: `prisma/schema.prisma`; MySQL: `prisma/mysql/schema.prisma`.
- Frontend: React, Vite, React Router, and Semi UI. Entry: `web/src/main.tsx`.
- Tests: Vitest via `vitest.config.ts`; integration tests live in `test/integration/`.
- Docs: VitePress configured by `docs/.vitepress/config.ts`.

## Runtime topology

```text
Browser / SDK
  ├─ /api/*       → Fastify business APIs
  ├─ /v1/*        → OpenAI and Claude-compatible relay
  ├─ /v1beta/*    → Gemini-compatible relay
  └─ other GET    → web/dist/index.html (React SPA)
```

`src/app.ts` registers plugins and route modules. `src/plugins/auth.ts` resolves sessions and API keys. Domain orchestration lives under `src/modules/`; reusable database, crypto, mail, and provider code lives under `src/lib/`.

## Main request flows

### Console APIs

1. A page calls `/api/*` through `web/src/lib/api.ts`.
2. `src/app.ts` dispatches to `src/modules/<domain>/routes.ts`.
3. The route validates input with Zod and uses `src/lib/prisma.ts`.
4. React contexts in `web/src/context/` refresh user or site state.

### Model relay

1. A client calls `/v1/chat/completions`, `/v1/responses`, `/v1/messages`, or `/v1beta/*`.
2. `src/modules/relay/routes.ts` authenticates the key and starts routing.
3. `model-routing.ts`, `channel-selector.ts`, and `balancer.ts` select a channel.
4. Provider adapters and services translate and forward the request.
5. `src/modules/relay/billing.ts` records tokens, quota, and usage logs.

### Authentication callback

1. `web/src/pages/Login.tsx` requests an OAuth state.
2. `src/modules/oauth/routes.ts` creates the authorization URL and exchanges identity data.
3. The browser returns to `web/src/pages/OAuthCallback.tsx`.
4. `web/src/lib/shared-request.ts` deduplicates one-time codes under React StrictMode.

## Directory ownership

| Directory | Responsibility |
| --- | --- |
| `src/modules/` | Fastify routes and domain orchestration |
| `src/lib/` | Reusable services, provider code, and data helpers |
| `src/plugins/` | Fastify plugins such as authentication |
| `web/src/pages/` | Route-level React pages |
| `web/src/components/` | Shared UI and domain components |
| `web/src/context/` | User, status, and theme state |
| `prisma/` | PostgreSQL/MySQL schemas and migrations |
| `test/integration/` | Real Fastify + Prisma integration coverage |
| `docs/` | English and Chinese documentation |

## Building a complete feature

1. Write a failing integration test under `test/integration/`.
2. Add the route to `src/modules/<domain>/routes.ts`.
3. Extract reusable logic into `src/lib/` when needed.
4. Apply data changes to both Prisma schemas and migration trees.
5. Add request and response types to `web/src/lib/api.ts`.
6. Build the UI in `web/src/pages/` or `web/src/components/`.
7. Register routes and navigation in `web/src/App.tsx` and `SiderBar.tsx`.
8. Add English/Chinese resources and tests.

## Verification

```bash
npm run build
npm run build:web
npm test
bun run --cwd docs build
```

For a focused domain test:

```bash
npm test -- --run test/integration/oauth.test.ts
```
