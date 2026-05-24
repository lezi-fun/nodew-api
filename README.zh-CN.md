# NodEW-api

[![GitHub repo](https://img.shields.io/badge/GitHub-lezi--fun%2Fnodew--api-181717?logo=github)](https://github.com/lezi-fun/nodew-api)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](./LICENSE)
![Node.js](https://img.shields.io/badge/Node.js-%3E%3D22-339933?logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)
![Fastify](https://img.shields.io/badge/Fastify-5.x-000000?logo=fastify&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-6.x-2D3748?logo=prisma&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=111111)
![Vite](https://img.shields.io/badge/Vite-6.x-646CFF?logo=vite&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-default-4169E1?logo=postgresql&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-supported-4479A1?logo=mysql&logoColor=white)
![OpenAI compatible](https://img.shields.io/badge/OpenAI-compatible-412991?logo=openai&logoColor=white)
![One API](https://img.shields.io/badge/One%20API-Node.js%20edition-10B981)
[![使用 Vercel 部署](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Flezi-fun%2Fnodew-api)

语言：[English](./README.md) | [简体中文](./README.zh-CN.md)

预览地址：<https://nodew.lezi.chat>

> 这是一个临时测试部署链接，用于预览当前 UI 和 API 流程，不是生产环境服务。

NodEW-api 是 One API 网关的 Node.js / TypeScript 版本，面向 OpenAI 兼容中转、多供应商渠道路由、令牌管理、用量日志和 Web 管理控制台。

项目仓库：<https://github.com/lezi-fun/nodew-api>

基于 One API：<https://github.com/songquanpeng/one-api>

Copyright 2026 lezi-fun Team. Licensed under the Apache License, Version 2.0.

## 项目状态

> NodEW-api 仍处于初步开发阶段，目前不建议用于生产环境。API、数据库结构、配置项和部署行为都可能在没有提前通知的情况下发生破坏性变更。欢迎贡献代码、测试反馈和 issue。

Serverless 部署方案正在持续开发中。

NodEW-api 使用 Fastify、Prisma、TypeScript、React、Vite 和 Semi UI 构建，目标是提供现代化的大模型中转网关与管理后台。

当前能力包括：

- `/v1` 下的 OpenAI 兼容 Relay 接口，支持 Chat Completions 和流式响应。
- 渠道管理，支持供应商 metadata、权重、优先级、连通性测试和模型同步。
- 令牌管理，支持额度、过期时间、模型 allow/block 策略。
- 账号安全流程，包含邮箱验证、密码重置和会话管理。
- 使用日志和面向计费的请求统计。
- 管理控制台，包含数据看板、渠道、令牌、用户、兑换码、日志、模型、部署、系统设置、钱包和操练场。
- 默认支持 PostgreSQL，并提供独立的 MySQL Prisma schema。

## 环境要求

- Node.js 22 或更高版本
- npm
- PostgreSQL
- 可选：MySQL

## 快速开始

> 早期开发提示：NodEW-api 目前不建议用于生产环境。API、数据库结构、配置项和部署行为都可能在没有提前通知的情况下发生破坏性变更。

安装依赖：

```bash
npm install
cd web
npm install
cd ..
```

创建 `.env`：

```bash
NODE_ENV=development
HOST=0.0.0.0
PORT=3000
LOG_LEVEL=info
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/nodew_api?schema=public"
SESSION_SECRET="nodew-dev-session-secret"
```

现在已经支持两种发信方式：`SMTP` 或 `Resend`。配置其中一种后，找回密码、邮箱验证，以及注册前邮箱验证邮件都会自动发送。

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

或者使用 Resend：

```bash
APP_BASE_URL="http://127.0.0.1:3000"
MAIL_PROVIDER="resend"
MAIL_FROM="noreply@example.com"
RESEND_API_KEY="re_xxx"
```

如果你准备在后台开启“注册前验证邮箱”，还需要保证上面的邮件配置可用。开启后：

- 用户必须先点击验证邮件中的链接，或者在注册页输入验证码。
- 验证完成后才能真正创建账号。
- 后台系统设置页会显示当前邮件通道状态，并支持发送测试邮件。

准备 Prisma：

```bash
npm run prisma:generate
npm run prisma:migrate:deploy
```

构建前端控制台：

```bash
cd web
npm run build
cd ..
```

启动开发服务：

```bash
npm run dev
```

打开 `http://127.0.0.1:3000`。

开发环境会自动确保以下管理员账号存在：

```text
邮箱：test@test.com
密码：testtest
```

开发 seed 是非破坏性的，只会 upsert 默认管理员和初始化状态，不会删除渠道、令牌、用户或日志。

## 生产构建

```bash
cd web
npm run build
cd ..
npm run build
npm run start
```

`npm run start` 会使用配置的 `HOST` 和 `PORT` 启动编译后的后端，并从 `web/dist` 提供前端静态资源。

## Vercel 部署

Vercel 支持目前仍是实验性的，Serverless 部署方案正在持续开发中。

[![使用 Vercel 部署](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Flezi-fun%2Fnodew-api)

仓库已包含：

- `api/server.js`：编译后 Fastify 应用的 Vercel Function 入口。
- `vercel.json`：构建、函数和路由重写配置。
- `installCommand`：使用 Bun 同时安装根目录后端依赖和 `web` 前端依赖。
- `bun run vercel-build`：生成 Prisma Client，构建后端，并构建 Web 控制台。

需要在 Vercel 中配置的环境变量：

```bash
NODE_ENV=production
LOG_LEVEL=info
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"
SESSION_SECRET="replace-with-a-long-random-secret"
CHANNEL_SECRET="replace-with-a-long-random-secret"
```

请使用 Neon、Supabase、RDS、Railway 或其他托管 PostgreSQL 数据库。Vercel 上不能使用 localhost 数据库。

部署前请先对生产数据库执行迁移：

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public" npm run prisma:migrate:deploy
```

Vercel 会把 `/api/*`、`/v1/*`、`/v1beta/*`、`/health` 和 `/ready` 转发到 Fastify Function。其他路径由 `web/dist` 中的 SPA 静态文件提供。

## 数据库

PostgreSQL 是默认数据库：

```bash
npm run prisma:generate:postgres
npm run prisma:migrate:deploy:postgres
```

MySQL 使用独立 schema：

```bash
export DATABASE_URL="mysql://nodew_api:nodew_api@localhost:3306/nodew_api"
npm run prisma:generate:mysql
npm run prisma:migrate:deploy:mysql
```

同一个构建产物只能使用一个 Prisma provider。切换数据库后需要重新生成 Prisma Client。

## 常用命令

```bash
npm run dev
npm run build
npm run start
npm test
```

前端控制台命令：

```bash
cd web
npm run dev
npm run build
npm run preview
```

## API 概览

Relay 接口：

- `GET /v1/models`
- `POST /v1/chat/completions`
- `POST /v1/completions`
- `POST /v1/embeddings`
- `POST /v1/responses`
- `POST /v1/images/generations`
- `POST /v1/audio/speech`
- `POST /v1/audio/transcriptions`
- `POST /v1/audio/translations`

管理控制台 API 位于 `/api`。

## 许可证

本项目采用 Apache License 2.0。详见 [LICENSE](./LICENSE)。
