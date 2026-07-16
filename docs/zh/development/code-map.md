# 代码地图

本页按“我要改什么功能”反查文件。所有路径都相对于仓库根目录。

| 功能 | 后端 | 前端 | 测试 |
| --- | --- | --- | --- |
| 初始化 | `src/modules/setup/routes.ts` | `web/src/pages/Setup.tsx`、`web/src/components/setup/` | `test/integration/compatibility-routes.test.ts` |
| 登录/注册 | `src/modules/auth/routes.ts`、`src/modules/auth/registration.ts` | `web/src/pages/Login.tsx`、`web/src/pages/Register.tsx` | `test/integration/auth-lifecycle.test.ts` |
| 邮箱验证/更换 | `src/modules/auth/email-verification.ts`、`src/modules/auth/email-binding.ts` | `web/src/pages/VerifyEmail.tsx`、`web/src/pages/Personal.tsx`、`web/src/components/security/EmailBindingModal.tsx` | `test/integration/auth-lifecycle.test.ts`、`test/auth-callback-i18n.test.ts` |
| 密码重置 | `src/modules/auth/password-reset.ts` | `web/src/pages/Reset.tsx`、`web/src/pages/ResetConfirm.tsx` | `test/integration/auth-lifecycle.test.ts` |
| OAuth 登录/绑定 | `src/modules/oauth/routes.ts`、`src/lib/oauth.ts`、`src/lib/oauth-config.ts`、`src/lib/oauth-access-policy.ts` | `web/src/pages/Login.tsx`、`web/src/pages/OAuthCallback.tsx`、`web/src/components/security/OAuthBindingCard.tsx` | `test/integration/oauth.test.ts` |
| 2FA | `src/modules/auth/routes.ts`、`src/lib/totp.ts` | `web/src/components/security/TwoFASettingCard.tsx` | `test/integration/twofa.test.ts` |
| Passkey | `src/modules/auth/routes.ts`、`src/lib/passkey.ts` | `web/src/components/security/PasskeySettingCard.tsx` | `test/integration/passkey.test.ts` |
| API Key | `src/modules/api-keys/routes.ts` | `web/src/pages/Token.tsx` | `test/integration/token-usage.test.ts` |
| 渠道 | `src/modules/channels/routes.ts` | `web/src/pages/Channel.tsx` | `test/integration/channels.test.ts` |
| Relay | `src/modules/relay/` | `web/src/pages/Playground.tsx`、`web/src/pages/Chat.tsx` | `test/integration/relay.test.ts`、`test/integration/relay-weighted-selection.test.ts`、`test/integration/relay-gemini.test.ts`、`test/integration/relay-responses.test.ts`、`test/integration/relay-embeddings.test.ts`、`test/integration/relay-claude.test.ts` |
| 模型 | `src/modules/relay/model-routing.ts`、`src/modules/channels/routes.ts` | `web/src/pages/Models.tsx`、`web/src/components/models/` | `test/integration/channels.test.ts` 和 relay 测试 |
| 日志/仪表盘 | `src/modules/usage/routes.ts`、`src/modules/dashboard/routes.ts` | `web/src/pages/Log.tsx`、`web/src/pages/Dashboard.tsx` | `test/integration/dashboard-routes.test.ts` |
| 充值 | `src/modules/billing/routes.ts`、`src/lib/stripe.ts`、`src/lib/creem.ts`、`src/lib/waffo.ts` | `web/src/pages/TopUp.tsx`、`web/src/pages/Pricing.tsx` | `test/integration/topup-stripe.test.ts`、`test/integration/topup-creem-config.test.ts`、`test/integration/topup-waffo-config.test.ts` |
| 订阅 | `src/modules/subscription/routes.ts`、`src/lib/subscription-plans.ts` | `web/src/pages/Subscription.tsx`、`web/src/components/billing/PricingOverview.tsx` | `test/integration/admin-subscription-plans.test.ts`、`test/integration/subscription-stripe.test.ts` |
| 用户管理 | `src/modules/admin/users/routes.ts` | `web/src/pages/User.tsx` | `test/integration/admin-users.test.ts` |
| 管理设置 | `src/modules/admin/options/routes.ts` | `web/src/pages/Setting.tsx` | `test/integration/admin-options.test.ts`、`test/settings-loader.test.ts`、`test/settings-sections.test.ts` |
| 对象存储 | `src/modules/admin/storage/routes.ts`、`src/lib/object-storage.ts` | `web/src/pages/Setting.tsx` | `test/integration/storage-config.test.ts` |
| 签到 | `src/modules/checkin/routes.ts` | `web/src/pages/Personal.tsx` | `test/integration/checkin.test.ts` |
| i18n | `prisma/schema.prisma`、`prisma/mysql/schema.prisma`、`src/modules/self/routes.ts` | `web/src/i18n/`、`web/src/main.tsx` | `test/i18n.test.ts`、`test/integration/user-language.test.ts` |
| 文档 | 无 | `docs/.vitepress/`、`docs/development/`、`docs/zh/development/` | `test/development-docs.test.ts`、`test/docs-file-dates.test.ts` |

## 常用共享文件

- `web/src/lib/api.ts`：前端接口契约，后端返回结构变化时必须同步。
- `web/src/lib/format.ts`：日期和额度显示。
- `web/src/lib/shared-request.ts`：一次性请求去重。
- `src/lib/crypto.ts`：敏感配置加密。
- `src/lib/mailer.ts` 和 `src/lib/mail-config.ts`：邮件发送与配置。
- `test/helpers/factories.ts`：集成测试数据工厂。

## 修改前检查

```bash
git status --short
npm test -- --run test/integration/<domain>.test.ts
```

修改后至少执行：

```bash
npm run build
npm run build:web
npm test
bun run --cwd docs build
```
