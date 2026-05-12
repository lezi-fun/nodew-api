# 快速开始

nodew-api 是 [One API](https://github.com/songquanpeng/one-api) 的 Node.js / TypeScript 版本，提供 OpenAI 兼容中转、数据库渠道系统、令牌管理、用量日志和 Web 管理控制台。

::: warning 初步开发中
项目仍处于初步开发阶段，目前不建议用于生产环境。API、数据库结构、配置项和部署行为都可能在没有提前通知的情况下发生破坏性变更。
:::

## 环境要求

- Node.js 22 或更高版本
- npm
- 默认使用 PostgreSQL
- 可选：使用 MySQL Prisma schema 时支持 MySQL

## 安装依赖

```bash
npm install
cd web
npm install
cd ..
```

## 环境变量

在仓库根目录创建 `.env`：

```bash
NODE_ENV=development
HOST=0.0.0.0
PORT=3000
LOG_LEVEL=info
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/nodew_api?schema=public"
SESSION_SECRET="nodew-dev-session-secret"
CHANNEL_SECRET="nodew-dev-channel-secret"
```

## 初始化数据库

```bash
npm run prisma:generate
npm run prisma:migrate:deploy
```

## 启动

```bash
npm run dev
```

打开 `http://127.0.0.1:3000`。

开发环境会自动确保以下管理员账号存在，并且不会清空已有数据：

```text
邮箱：test@test.com
密码：testtest
```

## 构建

```bash
cd web
npm run build
cd ..
npm run build
npm run start
```
