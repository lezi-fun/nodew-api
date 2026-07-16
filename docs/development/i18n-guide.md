# i18n Development Guide

The frontend uses i18next, react-i18next, and `i18next-browser-languagedetector`.

## Key files

- `web/src/i18n/i18n.ts`: resources, fallback, and detector order.
- `web/src/i18n/language.ts`: `zh-CN`/`en` normalization and preference priority.
- `web/src/i18n/locales/zh-CN.json`: Chinese resources.
- `web/src/i18n/locales/en.json`: English resources.
- `web/src/main.tsx`: user preference, localStorage, browser language, and `<html lang>` synchronization.
- `src/modules/self/routes.ts`: dedicated `User.language` persistence.

## Localizing a page

```tsx
import { useTranslation } from 'react-i18next';

const { t } = useTranslation();
return <Button>{t('保存')}</Button>;
```

English and Chinese JSON files must contain exactly the same keys. Use interpolation for dynamic values:

```tsx
t('验证时间 {{time}}', { time: formatDateTime(value) })
```

## Avoid

- Do not add a key to only one locale.
- Do not leave hardcoded Chinese in JSX, Toast, placeholders, or aria labels.
- Do not store language by replacing the complete `user.settings`; use `User.language` to avoid deleting subscription JSON.
- Do not switch an authenticated user's local language before server persistence succeeds.

## One-time callback pages

`VerifyEmail.tsx` and `OAuthCallback.tsx` consume one-time tokens/codes. React StrictMode remounts effects, so `web/src/lib/shared-request.ts` shares an in-flight promise. Failed requests are removed from the cache and can be retried.

## Tests

- `test/i18n.test.ts`: aligned keys, page wiring, and meaningful English values.
- `test/auth-callback-i18n.test.ts`: email/OAuth callback pages.
- `test/integration/user-language.test.ts`: server persistence without replacing settings.
- `test/shared-request.test.ts`: deduplication and retry behavior.

```bash
npm test -- --run test/i18n.test.ts test/auth-callback-i18n.test.ts
npm run build:web
```

Add every newly localized page to the coverage list in `test/i18n.test.ts`.
