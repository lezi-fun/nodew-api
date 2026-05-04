# nodew-api

nodew-api is an independent Node.js and TypeScript LLM gateway. The project is a clean-room implementation of modern multi-provider routing, administration, and relay workflows.

Copyright 2026 nodew-api Team. Licensed under the Apache License, Version 2.0.

## Local Development

Start the API server from the project root:

```bash
npm install
npm run build
npm run start
```

Start the web console in a second terminal:

```bash
cd web
npm install
pnpm start
```

The web console runs on `http://localhost:5173` and proxies API traffic to `http://127.0.0.1:3000`.

## Database Providers

PostgreSQL is the default database provider and uses `prisma/schema.prisma` plus the checked-in migration history:

```bash
npm run prisma:generate:postgres
npm run prisma:migrate:deploy:postgres
```

MySQL is supported through a dedicated Prisma schema and migration history. Set `DATABASE_URL` to a MySQL connection string, generate the MySQL Prisma Client, then apply the MySQL migrations:

```bash
docker compose --profile mysql up -d mysql
export DATABASE_URL="mysql://nodew_api:nodew_api@localhost:3306/nodew_api"
npm run prisma:generate:mysql
npm run prisma:migrate:deploy:mysql
```

Only one Prisma provider is active in a built deployment. If you switch between PostgreSQL and MySQL locally, regenerate the Prisma Client for the target provider before running `npm run build`.
