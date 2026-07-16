# Code Map

Use this page to find files by feature.

| Feature | Backend | Frontend | Tests |
| --- | --- | --- | --- |
| Setup | `src/modules/setup/routes.ts` | `web/src/pages/Setup.tsx`, `components/setup/` | `compatibility-routes.test.ts` |
| Login/registration | `src/modules/auth/routes.ts`, `registration.ts` | `Login.tsx`, `Register.tsx` | `auth-lifecycle.test.ts` |
| Email verification/change | `email-verification.ts`, `email-binding.ts` | `VerifyEmail.tsx`, `Personal.tsx`, `EmailBindingModal.tsx` | `auth-lifecycle.test.ts`, `auth-callback-i18n.test.ts` |
| Password reset | `password-reset.ts` | `Reset.tsx`, `ResetConfirm.tsx` | `auth-lifecycle.test.ts` |
| OAuth login/binding | `src/modules/oauth/routes.ts`, `src/lib/oauth*.ts` | `Login.tsx`, `OAuthCallback.tsx`, `OAuthBindingCard.tsx` | `oauth.test.ts` |
| 2FA | `auth/routes.ts`, `src/lib/totp.ts` | `TwoFASettingCard.tsx` | `twofa.test.ts` |
| Passkey | `auth/routes.ts`, `src/lib/passkey.ts` | `PasskeySettingCard.tsx` | `passkey.test.ts` |
| API keys | `src/modules/api-keys/routes.ts` | `Token.tsx` | `token-usage.test.ts` |
| Channels | `src/modules/channels/routes.ts` | `Channel.tsx` | `channels.test.ts` |
| Relay | `src/modules/relay/*` | `Playground.tsx`, `Chat.tsx` | `relay*.test.ts` |
| Models | `relay/model-routing.ts`, channel APIs | `Models.tsx`, `components/models/` | channel and relay tests |
| Logs/dashboard | `usage/routes.ts`, `dashboard/routes.ts` | `Log.tsx`, `Dashboard.tsx` | `dashboard-routes.test.ts` |
| Top-up | `billing/routes.ts`, `src/lib/stripe.ts`, `creem.ts`, `waffo.ts` | `TopUp.tsx`, `Pricing.tsx` | `topup-*.test.ts` |
| Subscription | `subscription/routes.ts`, `subscription-plans.ts` | `Subscription.tsx`, `PricingOverview.tsx` | subscription tests |
| Users | `src/modules/admin/users/routes.ts` | `User.tsx` | `admin-users.test.ts` |
| Options | `src/modules/admin/options/routes.ts` | `Setting.tsx` | `admin-options.test.ts`, `settings-*.test.ts` |
| Storage | `admin/storage/routes.ts`, `object-storage.ts` | `Setting.tsx` | `storage-config.test.ts` |
| Check-in | `checkin/routes.ts` | `Personal.tsx` | `checkin.test.ts` |
| i18n | `User.language`, `self/routes.ts` | `web/src/i18n/`, `main.tsx` | `i18n.test.ts`, `user-language.test.ts` |
| Docs | none | `docs/.vitepress/`, `docs/**/*.md` | `development-docs.test.ts`, `docs-file-dates.test.ts` |

## Shared files

- `web/src/lib/api.ts`: frontend API contract.
- `web/src/lib/format.ts`: dates and quota formatting.
- `web/src/lib/shared-request.ts`: one-time request deduplication.
- `src/lib/crypto.ts`: encrypted configuration.
- `src/lib/mailer.ts` / `mail-config.ts`: mail delivery and settings.
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
