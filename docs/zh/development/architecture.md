# 架构总览

本页说明 NodEW-api 从浏览器请求到上游模型响应的完整路径，以及开发新功能时通常需要修改的目录。

## 技术栈

- 后端：Node.js 22、TypeScript、Fastify，入口在 `src/server.ts` 和 `src/app.ts`。
- 数据层：Prisma，PostgreSQL schema 位于 `prisma/schema.prisma`，MySQL schema 位于 `prisma/mysql/schema.prisma`。
- 前端：React、Vite、React Router、Semi UI，入口在 `web/src/main.tsx`。
- 测试：Vitest，配置在 `vitest.config.ts`，集成测试位于 `test/integration/`。
- 文档：VitePress，配置在 `docs/.vitepress/config.ts`。

## 运行时结构

```text
浏览器 / SDK
  ├─ /api/*       → Fastify 业务 API
  ├─ /v1/*        → OpenAI/Claude 兼容中转
  ├─ /v1beta/*    → Gemini 兼容中转
  └─ 其他 GET     → web/dist/index.html（React SPA）
```

`src/app.ts` 负责注册插件和路由。认证插件 `src/plugins/auth.ts` 从 session cookie 或 API Key 中解析身份；业务模块集中在 `src/modules/`；共享数据库、加密、邮件和上游调用逻辑在 `src/lib/`。

## 三条主要请求链

### 管理和用户 API

1. 前端页面从 `web/src/lib/api.ts` 调用 `/api/*`。
2. `src/app.ts` 将请求转发到对应的 `src/modules/<domain>/routes.ts`。
3. 路由使用 Zod 校验参数，通过 `src/lib/prisma.ts` 访问数据库。
4. 响应返回后，`web/src/context/` 更新用户或站点状态。

### 模型中转

1. 客户端请求 `/v1/chat/completions`、`/v1/responses`、`/v1/messages` 或 `/v1beta/*`。
2. `src/modules/relay/routes.ts` 校验 API Key，并调用模型路由与渠道选择。
3. `src/modules/relay/model-routing.ts`、`channel-selector.ts`、`balancer.ts` 选择可用渠道。
4. provider adapter/service 转换请求并转发上游。
5. `src/modules/relay/billing.ts` 和用量日志记录 token 与额度。

### 认证回调

1. 登录页 `web/src/pages/Login.tsx` 获取 OAuth state。
2. 后端 `src/modules/oauth/routes.ts` 生成授权地址、校验 state 并交换用户资料。
3. 浏览器回到 `web/src/pages/OAuthCallback.tsx`。
4. 回调页使用 `web/src/lib/shared-request.ts` 去重 StrictMode 下的一次性 code 消费。

## 目录职责

| 目录 | 职责 |
| --- | --- |
| `src/modules/` | Fastify 路由和业务编排 |
| `src/lib/` | 可复用服务、provider、配置解析和数据辅助函数 |
| `src/plugins/` | Fastify 插件，例如认证 |
| `web/src/pages/` | 路由页面 |
| `web/src/components/` | 可复用 UI 和业务组件 |
| `web/src/context/` | 用户、状态、主题等全局状态 |
| `prisma/` | 双数据库 schema 与迁移 |
| `test/integration/` | 真实 Fastify + Prisma 集成测试 |
| `docs/` | 中英文用户和开发文档 |

## 开发一个完整功能

以新增管理功能为例：

1. 在 `test/integration/` 先写失败的 API 测试。
2. 在 `src/modules/<domain>/routes.ts` 增加路由。
3. 必要时在 `src/lib/` 提取独立业务函数。
4. 数据结构变化同时修改两个 Prisma schema 和两个 migrations 目录。
5. 在 `web/src/lib/api.ts` 增加类型与请求方法。
6. 在 `web/src/pages/` 或 `web/src/components/` 增加 UI。
7. 在 `web/src/App.tsx` 和 `SiderBar.tsx` 注册页面入口。
8. 增加中英文翻译与测试。

## 验证命令

```bash
npm run build
npm run build:web
npm test
bun run --cwd docs build
```

只验证单个功能时使用：

```bash
npm test -- --run test/integration/oauth.test.ts
```
