# 数据库

PostgreSQL 是默认数据库。MySQL 通过独立 Prisma schema 支持。

## PostgreSQL

```bash
npm run prisma:generate:postgres
npm run prisma:migrate:deploy:postgres
```

示例连接：

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/nodew_api?schema=public"
```

## MySQL

```bash
export DATABASE_URL="mysql://nodew_api:nodew_api@localhost:3306/nodew_api"
npm run prisma:generate:mysql
npm run prisma:migrate:deploy:mysql
```

同一个构建产物只能启用一个 Prisma provider。切换数据库后需要重新生成 Prisma Client。

## 测试

当前测试套件可能会重置其配置的测试数据库。开发、测试和生产数据库应分离。
