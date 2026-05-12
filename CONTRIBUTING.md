# Contributing to NodEW-api

Thank you for helping improve NodEW-api.

Repository: <https://github.com/lezi-fun/nodew-api>

## Project Principles

- NodEW-api is an independent Node.js and TypeScript implementation.
- Keep the codebase Apache-2.0 compatible.
- Do not add copied source code, copied license headers, or brand references from unrelated projects.
- Prefer clear, maintainable TypeScript over clever abstractions.
- Keep frontend changes aligned with the existing React, Vite, and Semi UI console patterns.

## Development Setup

Install dependencies:

```bash
npm install
cd web
npm install
cd ..
```

Create `.env` from the README example, then run:

```bash
npm run prisma:generate
npm run prisma:migrate:deploy
cd web
npm run build
cd ..
npm run dev
```

Default development admin:

```text
Email: test@test.com
Password: testtest
```

The development seed is intended for local development only and must remain guarded by `NODE_ENV=development`.

## Before Submitting

Run the relevant checks:

```bash
npm run build
cd web
npm run build
cd ..
npm test
```

If a change only touches documentation, build and test runs may be skipped, but mention that explicitly in the pull request.

## Code Style

- Use TypeScript for backend and frontend code.
- Keep files ASCII unless the file already uses non-ASCII content or the content is user-facing Chinese text.
- Use concise comments only when the code is not self-explanatory.
- Avoid destructive database operations outside tests.
- Avoid adding global state unless it is necessary for runtime integration.
- Do not commit generated local artifacts such as `.env`, logs, screenshots, or Playwright output.

## Backend Guidelines

- Keep relay code streaming-safe. Do not buffer SSE responses unless the endpoint explicitly requires non-streaming behavior.
- Preserve OpenAI-compatible request and response shapes where applicable.
- Validate request bodies with `zod`.
- Keep authentication and billing checks close to the relay path.
- Log enough context for debugging without storing raw secrets.
- Never return plaintext channel keys except when intentionally creating or rotating credentials.

## Frontend Guidelines

- Follow the existing console shell: fixed header, grouped sidebar, card-based dashboard, and reusable `ConsoleTablePage`.
- API calls should go through `web/src/lib/api.ts`.
- User-facing failures should show `Toast` messages or visible error states, not blank screens.
- Keep routes stable even when a backend module is still pending; use explicit placeholder states rather than broken navigation.

## Database Guidelines

- PostgreSQL is the default schema under `prisma/schema.prisma`.
- MySQL support lives under `prisma/mysql/schema.prisma`.
- Regenerate Prisma Client after changing schemas.
- Include migrations for schema changes.
- Tests should use isolated test data and must not intentionally reset development or production data.

## Commit Guidelines

Use short imperative commit messages, for example:

```text
Add relay usage summary
Fix console channel loading
Update setup documentation
```

Keep commits focused. Do not mix unrelated formatting, feature work, and refactors.

## Security

Do not commit secrets, API keys, private database URLs, session secrets, screenshots containing tokens, or production logs. If a secret is accidentally committed, rotate it immediately and document the cleanup in the pull request.

## License

By contributing, you agree that your contributions are licensed under the Apache License, Version 2.0.
