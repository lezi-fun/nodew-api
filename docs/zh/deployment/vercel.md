# Vercel 部署

::: warning 实验性支持
Vercel 支持仍处于实验阶段。Serverless 部署路径正在开发中，不应视为生产就绪方案。
:::

主应用使用仓库根目录的 `vercel.json` 构建 Fastify 后端和 Vite Web 控制台。

## 必需环境变量

```bash
NODE_ENV=production
LOG_LEVEL=info
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"
SESSION_SECRET="replace-with-a-long-random-secret"
CHANNEL_SECRET="replace-with-a-long-random-secret"
```

请使用托管 PostgreSQL。localhost 数据库无法在 Vercel 上工作。

## 持久化存储

Vercel Functions 不提供持久化本地磁盘。任务资产或生成媒体需要持久保存时，应配置外部 S3 兼容存储桶：

```bash
STORAGE_DRIVER=s3
STORAGE_ENDPOINT="https://<account>.r2.cloudflarestorage.com"
STORAGE_REGION="auto"
STORAGE_BUCKET="nodew-api"
STORAGE_ACCESS_KEY_ID="replace-with-access-key"
STORAGE_SECRET_ACCESS_KEY="replace-with-secret-key"
STORAGE_PUBLIC_BASE_URL="https://assets.example.com/"
STORAGE_PREFIX="nodew"
```

Cloudflare R2 比较适合 Vercel 场景：它提供 S3 兼容 API，也可以挂自定义域名或 CDN。
所有存储对象都会被强制放在 bucket 的 `nodew/` 目录下。

## 构建流程

当前构建命令：

```bash
bun run vercel-build
```

该命令会生成 Prisma Client、构建 TypeScript 后端，并构建 Web 控制台。

## 路由

Vercel 会把以下路径转发到 Fastify Function：

- `/api/*`
- `/v1/*`
- `/v1beta/*`
- `/health`
- `/ready`

其他路径由构建后的单页 Web 控制台提供。

## 预览

临时测试部署：

<https://nodew.lezi.chat>
