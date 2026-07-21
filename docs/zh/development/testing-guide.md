# 测试指南

项目使用 Vitest。`vitest.config.ts` 指定 Node 环境、`test/setup.ts` 和单进程 fork，避免共享数据库并发污染。

## 测试结构

- `test/setup.ts`：设置测试环境变量，每个测试前调用 `resetDatabase()`。
- `test/helpers/app.ts`：创建和关闭测试 Fastify。
- `test/helpers/db.ts`：按外键顺序清空数据库。
- `test/helpers/factories.ts`：用户、渠道、API Key 等工厂。
- `test/integration/`：请求真实路由并访问测试数据库。
- 根目录 `test/*.test.ts`：纯函数、资源、文档和配置测试。

## 命令

```bash
# 全量
npm test

# 单文件
npm test -- --run test/integration/oauth.test.ts

# 多文件
npm test -- --run test/i18n.test.ts test/auth-callback-i18n.test.ts

# 类型和构建
npm run build
npm run build:web

# 文档
bun run --cwd docs build
```

## TDD 流程

1. 先在 `test/` 写最小失败用例。
2. 运行目标文件，确认失败原因是功能缺失。
3. 写最小实现。
4. 重跑目标测试。
5. 运行全量测试和双端构建。

## 集成测试模式

```ts
const app = await createTestApp();
try {
  const response = await app.inject({ method: 'GET', url: '/api/...' });
  expect(response.statusCode).toBe(200);
} finally {
  await closeTestApp(app);
}
```

使用 `createUser()`、`createApiKey()`、`createChannel()` 等 factory，不要手写不完整的外键记录。

## 数据库要求

默认测试 URL 在 `test/setup.ts`，本机 PostgreSQL 必须可访问。新增 migration 后先执行：

```bash
npm run prisma:generate
npm run prisma:migrate:deploy
```

如果全量测试偶发出现 401 或外键失败，而单文件立即通过，通常是外部并发测试进程操作同一数据库；先确认是否有其他 Vitest/Codex 进程，再重跑。不要把真实回归直接当成抖动忽略。

## 完整测试文件索引
| 文件 | 覆盖内容 |
| --- | --- |
| `test/auth-callback-i18n.test.ts` | 邮箱验证和 OAuth 回调页翻译覆盖。 |
| `test/development-docs.test.ts` | 开发文档、侧边栏、footer 和逐文件覆盖。 |
| `test/docs-file-dates.test.ts` | 文档 Git 创建/更新日期与文件时间回退。 |
| `test/helpers/app.ts` | 创建/关闭测试 Fastify 应用。 |
| `test/helpers/db.ts` | 按外键顺序清空测试数据库。 |
| `test/helpers/factories.ts` | 用户、渠道、API Key 等测试数据工厂。 |
| `test/helpers/fetch.ts` | fetch.ts 功能的 Fastify/Prisma 集成行为。 |
| `test/app-shell.test.ts` | 控制台外壳设计 token、响应式抽屉、无障碍和角色导航。 |
| `test/dashboard-page.test.ts` | Dashboard 加载回调和 effect 依赖关系的回归覆盖。 |
| `test/i18n.test.ts` | 全局翻译资源键、页面接线和语言偏好。 |
| `test/integration/admin-bind-subscription.test.ts` | admin-bind-subscription 功能的 Fastify/Prisma 集成行为。 |
| `test/integration/admin-groups.test.ts` | admin-groups 功能的 Fastify/Prisma 集成行为。 |
| `test/integration/admin-options.test.ts` | admin-options 功能的 Fastify/Prisma 集成行为。 |
| `test/integration/admin-redemptions.test.ts` | admin-redemptions 功能的 Fastify/Prisma 集成行为。 |
| `test/integration/admin-subscription-plans.test.ts` | admin-subscription-plans 功能的 Fastify/Prisma 集成行为。 |
| `test/integration/admin-users.test.ts` | admin-users 功能的 Fastify/Prisma 集成行为。 |
| `test/integration/auth-lifecycle.test.ts` | auth-lifecycle 功能的 Fastify/Prisma 集成行为。 |
| `test/integration/channels.test.ts` | channels 功能的 Fastify/Prisma 集成行为。 |
| `test/integration/checkin.test.ts` | checkin 功能的 Fastify/Prisma 集成行为。 |
| `test/integration/compatibility-routes.test.ts` | compatibility-routes 功能的 Fastify/Prisma 集成行为。 |
| `test/integration/dashboard-routes.test.ts` | dashboard-routes 功能的 Fastify/Prisma 集成行为。 |
| `test/integration/oauth.test.ts` | oauth 功能的 Fastify/Prisma 集成行为。 |
| `test/integration/passkey.test.ts` | passkey 功能的 Fastify/Prisma 集成行为。 |
| `test/integration/operation-settings.test.ts` | 运营配置持久化和行为验证。 |
| `test/integration/payment-settings.test.ts` | 支付设置持久化、密钥脱敏和运行时 checkout 行为。 |
| `test/integration/ratio-settings.test.ts` | 模型/分组倍率存储与计费集成。 |
| `test/integration/relay-claude.test.ts` | relay-claude 功能的 Fastify/Prisma 集成行为。 |
| `test/integration/relay-embeddings.test.ts` | relay-embeddings 功能的 Fastify/Prisma 集成行为。 |
| `test/integration/relay-gemini.test.ts` | relay-gemini 功能的 Fastify/Prisma 集成行为。 |
| `test/integration/relay-responses.test.ts` | relay-responses 功能的 Fastify/Prisma 集成行为。 |
| `test/integration/relay-weighted-selection.test.ts` | relay-weighted-selection 功能的 Fastify/Prisma 集成行为。 |
| `test/integration/relay.test.ts` | relay 功能的 Fastify/Prisma 集成行为。 |
| `test/integration/storage-config.test.ts` | storage-config 功能的 Fastify/Prisma 集成行为。 |
| `test/integration/subscription-stripe.test.ts` | subscription-stripe 功能的 Fastify/Prisma 集成行为。 |
| `test/integration/task-routes.test.ts` | 任务列表、视频任务、筛选和权限路由行为。 |
| `test/integration/token-usage.test.ts` | token-usage 功能的 Fastify/Prisma 集成行为。 |
| `test/integration/topup-creem-config.test.ts` | topup-creem-config 功能的 Fastify/Prisma 集成行为。 |
| `test/integration/topup-stripe.test.ts` | topup-stripe 功能的 Fastify/Prisma 集成行为。 |
| `test/integration/topup-waffo-config.test.ts` | topup-waffo-config 功能的 Fastify/Prisma 集成行为。 |
| `test/integration/twofa.test.ts` | twofa 功能的 Fastify/Prisma 集成行为。 |
| `test/integration/user-language.test.ts` | user-language 功能的 Fastify/Prisma 集成行为。 |
| `test/integration/user-redemptions.test.ts` | user-redemptions 功能的 Fastify/Prisma 集成行为。 |
| `test/mailer.test.ts` | 邮件 URL 和模板生成。 |
| `test/settings-loader.test.ts` | 设置资源部分失败隔离。 |
| `test/settings-sections.test.ts` | 设置业务域、URL 和导航辅助函数。 |
| `test/setup.ts` | Vitest 全局环境、数据库重置和资源清理。 |
| `test/shared-request.test.ts` | 一次性异步请求去重、清理和重试。 |

## 提交前门禁

```bash
git diff --check
npm run build
npm run build:web
npm test
bun run --cwd docs build
```

涉及迁移时还要校验 `prisma/mysql/schema.prisma`。
