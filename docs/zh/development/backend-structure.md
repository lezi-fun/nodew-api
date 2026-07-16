# 后端结构

后端采用“路由模块负责协议和编排，`src/lib/` 负责可复用业务逻辑”的结构。

## 启动与基础设施

| 文件 | 说明 |
| --- | --- |
| `src/server.ts` | 进程入口，调用 `startApp()` |
| `src/app.ts` | 创建 Fastify、注册 CORS/Helmet/静态文件/全部路由 |
| `src/config/env.ts` | 环境变量 schema、默认值和解析 |
| `src/lib/prisma.ts` | Prisma Client 单例 |
| `src/plugins/auth.ts` | session、API Key、管理员权限 preHandler |
| `src/bootstrap/dev-seed.ts` | 开发环境管理员和演示数据 |

## 认证与账户

| 功能 | 路由/实现 | 测试 |
| --- | --- | --- |
| 注册、登录、2FA、Passkey | `src/modules/auth/routes.ts` | `test/integration/auth-lifecycle.test.ts`、`twofa.test.ts`、`passkey.test.ts` |
| 邮箱验证 | `src/modules/auth/email-verification.ts` | `auth-lifecycle.test.ts` |
| 注册前验证 | `src/modules/auth/pending-registration.ts`、`registration.ts` | `auth-lifecycle.test.ts` |
| 邮箱更换 | `src/modules/auth/email-binding.ts` | `auth-lifecycle.test.ts` |
| 密码重置 | `src/modules/auth/password-reset.ts` | `auth-lifecycle.test.ts` |
| 当前用户 | `src/modules/self/routes.ts` | `user-language.test.ts` 等 |
| TOTP | `src/lib/totp.ts` | `twofa.test.ts` |
| Passkey 公共逻辑 | `src/lib/passkey.ts` | `passkey.test.ts` |

## OAuth

- `src/modules/oauth/routes.ts`：state、callback、登录和绑定路由。
- `src/lib/oauth.ts`：provider 请求和身份标准化。
- `src/lib/oauth-config.ts`：GitHub、OIDC、自定义 provider 配置。
- `src/lib/oauth-access-policy.ts`：访问策略判断。
- `test/integration/oauth.test.ts`：登录、绑定、2FA、重定向和错误路径。

修改 OAuth 时必须同步检查 `web/src/pages/Login.tsx`、`OAuthCallback.tsx` 和 `web/src/lib/oauth.tsx`。

## Relay

| 文件 | 说明 |
| --- | --- |
| `src/modules/relay/routes.ts` | `/v1`、`/v1beta` HTTP 入口 |
| `service.ts` / `executor.ts` | 请求执行和通用重试 |
| `model-routing.ts` | 模型到渠道的候选计算 |
| `channel-selector.ts` / `balancer.ts` | 权重和健康度选择 |
| `channel-health.ts` | 失败、冷却和恢复 |
| `billing.ts` | token/额度计费 |
| `openai-*` | OpenAI chat adapter/service |
| `responses-*` | Responses API |
| `claude-*` | Anthropic Messages |
| `gemini-*` | Gemini 与 OpenAI 兼容转换 |
| `embeddings-service.ts` | Embeddings |
| `media-storage.ts` / `multipart.ts` | 文件和多模态请求 |

对应测试是 `relay.test.ts`、`relay-responses.test.ts`、`relay-claude.test.ts`、`relay-gemini.test.ts`、`relay-embeddings.test.ts` 和 `relay-weighted-selection.test.ts`。

## 业务模块

- 渠道：`src/modules/channels/routes.ts`。
- API Key：`src/modules/api-keys/routes.ts`。
- 用量日志：`src/modules/usage/routes.ts`。
- 仪表盘：`src/modules/dashboard/routes.ts`。
- 签到：`src/modules/checkin/routes.ts`。
- 充值：`src/modules/billing/routes.ts`，provider 在 `src/lib/stripe.ts`、`creem.ts`、`waffo.ts`。
- 订阅：`src/modules/subscription/routes.ts`、`src/lib/subscription-plans.ts`、`user-subscriptions.ts`。
- 管理员：`src/modules/admin/*/routes.ts`。
- 对象存储：`src/modules/admin/storage/routes.ts` 和 `src/lib/object-storage.ts`。

## 完整后端文件索引
| 文件 | 职责 |
| --- | --- |
| `src/app.ts` | 创建 Fastify 应用，注册插件、API/relay 路由、静态 SPA 和健康检查。 |
| `src/bootstrap/dev-seed.ts` | 保证开发管理员、SetupState 和默认系统选项存在。 |
| `src/config/env.ts` | 用 Zod 定义并解析全部运行环境变量。 |
| `src/lib/creem.ts` | Creem 商品配置、checkout 和 webhook 校验。 |
| `src/lib/crypto.ts` | 密码、API Key、验证码、兑换码和渠道密钥的生成/哈希/加密。 |
| `src/lib/mail-config.ts` | 合并环境与数据库邮件配置并执行有效性检查。 |
| `src/lib/mailer.ts` | SMTP/Resend 发送器和验证、绑定、注册、重置邮件模板。 |
| `src/lib/oauth-access-policy.ts` | 解析并执行自定义 OAuth 用户访问策略。 |
| `src/lib/oauth-config.ts` | 读取内置与自定义 OAuth provider 的运行配置。 |
| `src/lib/oauth.ts` | OAuth state cookie、内置 provider 基础配置和类型。 |
| `src/lib/object-storage.ts` | S3 兼容签名、上传、删除和公共 URL。 |
| `src/lib/passkey.ts` | Passkey 配置、secure-verification cookie 和 WebAuthn 辅助逻辑。 |
| `src/lib/prisma.ts` | Prisma Client 单例和开发热重载复用。 |
| `src/lib/stripe.ts` | Stripe checkout 配置、创建会话和 webhook 签名。 |
| `src/lib/subscription-plans.ts` | 数据库系统选项中的订阅套餐读取、排序和 CRUD。 |
| `src/lib/totp.ts` | TOTP secret/code、otpauth URI 和备用码。 |
| `src/lib/user-subscriptions.ts` | 用户 settings 中订阅记录的规范化、追加和有效期计算。 |
| `src/lib/waffo.ts` | Waffo 商品配置、RSA 签名、checkout 和 webhook 校验。 |
| `src/modules/admin/groups/routes.ts` | 用户组 CRUD。 |
| `src/modules/admin/options/routes.ts` | 系统选项、邮件、OAuth 和测试邮件配置 API。 |
| `src/modules/admin/redemptions/routes.ts` | 兑换码创建、更新、删除和批量管理。 |
| `src/modules/admin/storage/routes.ts` | 对象存储配置读写和连接状态。 |
| `src/modules/admin/users/routes.ts` | 管理员用户 CRUD、额度、组、OAuth/2FA/Passkey 管理。 |
| `src/modules/api-keys/routes.ts` | 用户 API Key 的创建、列表、更新和删除。 |
| `src/modules/auth/email-binding.ts` | 新邮箱 token/code 的请求与确认。 |
| `src/modules/auth/email-verification.ts` | 账户邮箱验证 token 的生命周期。 |
| `src/modules/auth/password-reset.ts` | 密码重置 token 的签发、验证和会话失效。 |
| `src/modules/auth/pending-registration.ts` | 注册前验证临时记录的创建、读取和删除。 |
| `src/modules/auth/registration.ts` | 注册开关、邮箱验证策略和身份唯一性检查。 |
| `src/modules/auth/routes.ts` | 注册、登录、2FA、Passkey、邮箱/密码流程的主路由。 |
| `src/modules/auth/twofa-login-challenge.ts` | 2FA 登录挑战 cookie 的设置、读取和清除。 |
| `src/modules/billing/routes.ts` | 公开价格、充值配置、checkout、订单和 webhook。 |
| `src/modules/channels/routes.ts` | 渠道 CRUD、批量操作、连接测试和模型发现。 |
| `src/modules/checkin/routes.ts` | 每日签到、随机奖励、月历和连续签到统计。 |
| `src/modules/compatibility/routes.ts` | 兼容旧 One API/前端调用约定的端点。 |
| `src/modules/dashboard/routes.ts` | 控制台指标和最近活动聚合。 |
| `src/modules/oauth/routes.ts` | OAuth state、callback、登录和账户绑定 API。 |
| `src/modules/relay/balancer.ts` | 平滑加权/选择状态持久化。 |
| `src/modules/relay/billing.ts` | 用量提取、价格倍率、额度扣减和日志写入。 |
| `src/modules/relay/channel-health.ts` | 失败计数、冷却、禁用和成功恢复。 |
| `src/modules/relay/channel-selector.ts` | 按权重和健康状态挑选渠道。 |
| `src/modules/relay/claude-adapter.ts` | OpenAI/内部格式与 Claude Messages 转换。 |
| `src/modules/relay/claude-service.ts` | Anthropic Messages 请求、流和用量处理。 |
| `src/modules/relay/embeddings-service.ts` | Embeddings 转发与计费。 |
| `src/modules/relay/executor.ts` | 执行候选渠道、重试和流式响应生命周期。 |
| `src/modules/relay/gemini-adapter.ts` | Gemini 原生请求/响应转换。 |
| `src/modules/relay/gemini-openai-adapter.ts` | Gemini 与 OpenAI chat 格式互转。 |
| `src/modules/relay/gemini-service.ts` | Gemini generateContent/streamGenerateContent 转发。 |
| `src/modules/relay/media-storage.ts` | 中转产生的媒体持久化到对象存储。 |
| `src/modules/relay/model-routing.ts` | 模型匹配、分组倍率和候选渠道生成。 |
| `src/modules/relay/multipart.ts` | multipart/form-data 的解析与重建。 |
| `src/modules/relay/openai-adapter.ts` | OpenAI 请求/响应规范化。 |
| `src/modules/relay/openai-service.ts` | OpenAI 兼容上游转发。 |
| `src/modules/relay/providers.ts` | provider 默认 URL、header 和能力映射。 |
| `src/modules/relay/rate-limit.ts` | 基于内存的请求速率限制。 |
| `src/modules/relay/responses-service.ts` | OpenAI Responses API 转发与用量提取。 |
| `src/modules/relay/routes.ts` | OpenAI/Claude/Gemini 兼容 HTTP 路由入口。 |
| `src/modules/relay/service.ts` | Chat Completions 通用业务入口。 |
| `src/modules/relay/types.ts` | relay 渠道、请求、执行结果和计费共享类型。 |
| `src/modules/self/routes.ts` | 当前用户资料、语言、密码、2FA、Passkey 和 OAuth 绑定 API。 |
| `src/modules/setup/routes.ts` | 初始化状态和首个管理员创建 API。 |
| `src/modules/status/routes.ts` | 公开站点状态、认证能力和前端启动配置。 |
| `src/modules/subscription/routes.ts` | 套餐展示、购买、管理员套餐 CRUD 和手动绑定。 |
| `src/modules/usage/routes.ts` | 用量日志分页、摘要和 token 维度统计。 |
| `src/plugins/auth.ts` | session/API Key 认证和用户/管理员/relay preHandler。 |
| `src/server.ts` | 进程入口，读取环境并启动监听。 |

## 数据库变更

任何模型变更都要同时更新：

```text
prisma/schema.prisma
prisma/mysql/schema.prisma
prisma/migrations/<timestamp>_name/migration.sql
prisma/mysql/migrations/<timestamp>_name/migration.sql
```

然后执行：

```bash
npm run prisma:generate
npm run prisma:migrate:dev
DATABASE_URL='mysql://user:pass@localhost:3306/nodew_api' npx prisma validate --schema prisma/mysql/schema.prisma
```

## 测试和调试

```bash
npm run build
npm test -- --run test/integration/auth-lifecycle.test.ts
npm test -- --run test/integration/relay.test.ts
```

集成测试通过 `test/helpers/app.ts` 创建 Fastify，`test/helpers/factories.ts` 创建用户、渠道和 API Key，`test/setup.ts` 在每个测试前清理数据库。
