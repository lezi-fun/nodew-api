# Code Map

Use this page to find files by feature. Every path is relative to the repository root.

| Feature | Backend | Frontend | Tests |
| --- | --- | --- | --- |
| Setup | `src/modules/setup/routes.ts` | `web/src/pages/Setup.tsx`, `web/src/components/setup/` | `test/integration/compatibility-routes.test.ts` |
| Login/registration | `src/modules/auth/routes.ts`, `src/modules/auth/registration.ts` | `web/src/pages/Login.tsx`, `web/src/pages/Register.tsx` | `test/integration/auth-lifecycle.test.ts` |
| Email verification/change | `src/modules/auth/email-verification.ts`, `src/modules/auth/email-binding.ts` | `web/src/pages/VerifyEmail.tsx`, `web/src/pages/Personal.tsx`, `web/src/components/security/EmailBindingModal.tsx` | `test/integration/auth-lifecycle.test.ts`, `test/auth-callback-i18n.test.ts` |
| Password reset | `src/modules/auth/password-reset.ts` | `web/src/pages/Reset.tsx`, `web/src/pages/ResetConfirm.tsx` | `test/integration/auth-lifecycle.test.ts` |
| OAuth login/binding | `src/modules/oauth/routes.ts`, `src/lib/oauth.ts`, `src/lib/oauth-config.ts`, `src/lib/oauth-access-policy.ts` | `web/src/pages/Login.tsx`, `web/src/pages/OAuthCallback.tsx`, `web/src/components/security/OAuthBindingCard.tsx` | `test/integration/oauth.test.ts` |
| 2FA | `src/modules/auth/routes.ts`, `src/lib/totp.ts` | `web/src/components/security/TwoFASettingCard.tsx` | `test/integration/twofa.test.ts` |
| Passkey | `src/modules/auth/routes.ts`, `src/lib/passkey.ts` | `web/src/components/security/PasskeySettingCard.tsx` | `test/integration/passkey.test.ts` |
| API keys | `src/modules/api-keys/routes.ts` | `web/src/pages/Token.tsx` | `test/integration/token-usage.test.ts` |
| Channels | `src/modules/channels/routes.ts` | `web/src/pages/Channel.tsx` | `test/integration/channels.test.ts` |
| Relay | `src/modules/relay/` | `web/src/pages/Playground.tsx`, `web/src/pages/Chat.tsx` | `test/integration/relay.test.ts`, `test/integration/relay-weighted-selection.test.ts`, `test/integration/relay-gemini.test.ts`, `test/integration/relay-responses.test.ts`, `test/integration/relay-embeddings.test.ts`, `test/integration/relay-claude.test.ts` |
| Models | `src/modules/relay/model-routing.ts`, `src/modules/channels/routes.ts` | `web/src/pages/Models.tsx`, `web/src/components/models/` | `test/integration/channels.test.ts` and relay tests |
| Logs/dashboard | `src/modules/usage/routes.ts`, `src/modules/dashboard/routes.ts` | `web/src/pages/Log.tsx`, `web/src/pages/Dashboard.tsx` | `test/integration/dashboard-routes.test.ts` |
| Top-up | `src/modules/billing/routes.ts`, `src/lib/stripe.ts`, `src/lib/creem.ts`, `src/lib/waffo.ts` | `web/src/pages/TopUp.tsx`, `web/src/pages/Pricing.tsx` | `test/integration/topup-stripe.test.ts`, `test/integration/topup-creem-config.test.ts`, `test/integration/topup-waffo-config.test.ts` |
| Subscription | `src/modules/subscription/routes.ts`, `src/lib/subscription-plans.ts` | `web/src/pages/Subscription.tsx`, `web/src/components/billing/PricingOverview.tsx` | `test/integration/admin-subscription-plans.test.ts`, `test/integration/subscription-stripe.test.ts` |
| Users | `src/modules/admin/users/routes.ts` | `web/src/pages/User.tsx` | `test/integration/admin-users.test.ts` |
| Options | `src/modules/admin/options/routes.ts` | `web/src/pages/Setting.tsx` | `test/integration/admin-options.test.ts`, `test/settings-loader.test.ts`, `test/settings-sections.test.ts` |
| Storage | `src/modules/admin/storage/routes.ts`, `src/lib/object-storage.ts` | `web/src/pages/Setting.tsx` | `test/integration/storage-config.test.ts` |
| Check-in | `src/modules/checkin/routes.ts` | `web/src/pages/Personal.tsx` | `test/integration/checkin.test.ts` |
| i18n | `prisma/schema.prisma`, `prisma/mysql/schema.prisma`, `src/modules/self/routes.ts` | `web/src/i18n/`, `web/src/main.tsx` | `test/i18n.test.ts`, `test/integration/user-language.test.ts` |
| Docs | None | `docs/.vitepress/`, `docs/development/`, `docs/zh/development/` | `test/development-docs.test.ts`, `test/docs-file-dates.test.ts` |

## Shared files

- `web/src/lib/api.ts`: frontend API contract.
- `web/src/lib/format.ts`: dates and quota formatting.
- `web/src/lib/shared-request.ts`: one-time request deduplication.
- `src/lib/crypto.ts`: encrypted configuration.
- `src/lib/mailer.ts` and `src/lib/mail-config.ts`: mail delivery and settings.
- `test/helpers/factories.ts`: integration-test factories.

## Before and after a change

```bash
git status --short
npm test -- --run test/integration/<domain>.test.ts
npm run build
npm run build:web
npm test
bun run --cwd docs build
```
