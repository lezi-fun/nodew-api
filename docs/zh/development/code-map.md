# 代码地图

本页按“我要改什么功能”反查文件。

| 功能 | 后端 | 前端 | 测试 |
| --- | --- | --- | --- |
| 初始化 | `src/modules/setup/routes.ts` | `web/src/pages/Setup.tsx`、`components/setup/` | `test/integration/compatibility-routes.test.ts` |
| 登录/注册 | `src/modules/auth/routes.ts`、`registration.ts` | `Login.tsx`、`Register.tsx` | `auth-lifecycle.test.ts` |
| 邮箱验证/更换 | `email-verification.ts`、`email-binding.ts` | `VerifyEmail.tsx`、`Personal.tsx`、`EmailBindingModal.tsx` | `auth-lifecycle.test.ts`、`auth-callback-i18n.test.ts` |
| 密码重置 | `password-reset.ts` | `Reset.tsx`、`ResetConfirm.tsx` | `auth-lifecycle.test.ts` |
| OAuth 登录/绑定 | `src/modules/oauth/routes.ts`、`src/lib/oauth*.ts` | `Login.tsx`、`OAuthCallback.tsx`、`OAuthBindingCard.tsx` | `oauth.test.ts` |
| 2FA | `auth/routes.ts`、`src/lib/totp.ts` | `TwoFASettingCard.tsx` | `twofa.test.ts` |
| Passkey | `auth/routes.ts`、`src/lib/passkey.ts` | `PasskeySettingCard.tsx` | `passkey.test.ts` |
| API Key | `src/modules/api-keys/routes.ts` | `Token.tsx` | `token-usage.test.ts` |
| 渠道 | `src/modules/channels/routes.ts` | `Channel.tsx` | `channels.test.ts` |
| Relay | `src/modules/relay/*` | `Playground.tsx`、`Chat.tsx` | `relay*.test.ts` |
| 模型 | `relay/model-routing.ts`、channels API | `Models.tsx`、`components/models/` | `channels.test.ts`、relay tests |
| 日志/仪表盘 | `usage/routes.ts`、`dashboard/routes.ts` | `Log.tsx`、`Dashboard.tsx` | `dashboard-routes.test.ts` |
| 充值 | `billing/routes.ts`、`src/lib/stripe.ts`、`creem.ts`、`waffo.ts` | `TopUp.tsx`、`Pricing.tsx` | `topup-*.test.ts` |
| 订阅 | `subscription/routes.ts`、`subscription-plans.ts` | `Subscription.tsx`、`PricingOverview.tsx` | `admin-subscription-plans.test.ts`、`subscription-stripe.test.ts` |
| 用户管理 | `src/modules/admin/users/routes.ts` | `User.tsx` | `admin-users.test.ts` |
| 管理设置 | `src/modules/admin/options/routes.ts` | `Setting.tsx` | `admin-options.test.ts`、`settings-*.test.ts` |
| 对象存储 | `admin/storage/routes.ts`、`object-storage.ts` | `Setting.tsx` | `storage-config.test.ts` |
| 签到 | `checkin/routes.ts` | `Personal.tsx` | `checkin.test.ts` |
| i18n | `User.language`、`self/routes.ts` | `web/src/i18n/`、`main.tsx` | `i18n.test.ts`、`user-language.test.ts` |
| 文档 | 无 | `docs/.vitepress/`、`docs/**/*.md` | `development-docs.test.ts`、`docs-file-dates.test.ts` |

## 常用共享文件

- `web/src/lib/api.ts`：前端接口契约，后端返回结构变化时必须同步。
- `web/src/lib/format.ts`：日期和额度显示。
- `web/src/lib/shared-request.ts`：一次性请求去重。
- `src/lib/crypto.ts`：敏感配置加密。
- `src/lib/mailer.ts` / `mail-config.ts`：邮件发送与配置。
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
