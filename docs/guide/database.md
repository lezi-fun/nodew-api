# Database

PostgreSQL is the default database provider. MySQL is supported through a dedicated Prisma schema.

## PostgreSQL

```bash
npm run prisma:generate:postgres
npm run prisma:migrate:deploy:postgres
```

Example URL:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/nodew_api?schema=public"
```

## MySQL

```bash
export DATABASE_URL="mysql://nodew_api:nodew_api@localhost:3306/nodew_api"
npm run prisma:generate:mysql
npm run prisma:migrate:deploy:mysql
```

Only one Prisma provider is active in a built deployment. Regenerate Prisma Client after switching database providers.

## Tests

The current test suite may reset its configured test database. Keep development, test, and production databases separate.
