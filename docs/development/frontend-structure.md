# Frontend Structure

The frontend lives in `web/` and uses React, React Router, Vite, Semi UI, and i18next.

## Entry and global state

| File | Responsibility |
| --- | --- |
| `web/src/main.tsx` | Mounts React, composes providers, and synchronizes language/Semi locale |
| `web/src/App.tsx` | Routes, recoverable lazy loading, PrivateRoute, and AdminRoute |
| `web/src/context/User.tsx` | Current user, refresh, and logout |
| `web/src/context/Status.tsx` | Public site status and provider capabilities |
| `web/src/context/Theme.tsx` | Light/dark theme |
| `web/src/lib/api.ts` | Axios client, API types, and every frontend request |

## Layout

- `web/src/components/layout/PageLayout.tsx`: public and console shell.
- `headerbar.tsx`: header, language switch, and user menu.
- `SiderBar.tsx`: console navigation and permission groups.
- `Footer.tsx`: footer.
- `SetupCheck.tsx`: setup-state guard.

## Page groups

### Public and authentication

`Home.tsx`, `Login.tsx`, `Register.tsx`, `Reset.tsx`, `ResetConfirm.tsx`, `VerifyEmail.tsx`, `OAuthCallback.tsx`, `Pricing.tsx`, `About.tsx`, and `Setup.tsx`.

Email verification and OAuth callbacks consume one-time values. They use `web/src/lib/shared-request.ts` to avoid duplicate token/code consumption under React StrictMode.

### User console

- `Dashboard.tsx`: metrics and overview.
- `Token.tsx`: API keys.
- `Playground.tsx` / `Chat.tsx`: model calls.
- `TopUp.tsx` / `Subscription.tsx`: payment and subscriptions.
- `Personal.tsx`: profile, email, OAuth, 2FA, Passkey, and check-in.
- `Log.tsx`, `Task.tsx`, `Midjourney.tsx`: logs and asynchronous results.

### Administration

`Channel.tsx`, `User.tsx`, `Redemption.tsx`, `Models.tsx`, `Deployment.tsx`, and `Setting.tsx`.

`Setting.tsx` uses `web/src/features/settings/sections.ts` for general/security/oauth/billing sections and `SettingsPageHeader.tsx` for the page header and domain navigation, while `settings-loader.ts` isolates failed resources.

## Component directories

- `components/security/`: 2FA, Passkey, OAuth, email, and secure verification.
- `components/billing/`: pricing and plan presentation.
- `components/models/`: model coverage and upstream selection.
- `components/common/`: table pages, error boundaries, loading, route errors.
- `components/setup/`: setup-wizard steps.
- `features/settings/`: settings-specific navigation, section metadata, and page-shell components.

## Complete frontend file index
| File | Responsibility |
| --- | --- |
| `web/src/App.tsx` | Route table, authorization guards, and lazy-load recovery. |
| `web/src/components/billing/PricingOverview.tsx` | Pricing metrics and plan cards. |
| `web/src/components/common/ConsoleTablePage.tsx` | Shared console table, filter, and pagination shell. |
| `web/src/components/common/ErrorBoundary.tsx` | React page error boundary and recovery. |
| `web/src/components/common/Loading.tsx` | Shared loading state. |
| `web/src/components/common/RouteError.tsx` | Route error presentation. |
| `web/src/components/layout/Footer.tsx` | Global footer. |
| `web/src/components/layout/PageLayout.tsx` | Public/console layout and mobile drawer. |
| `web/src/components/layout/SetupCheck.tsx` | Legacy layout-level setup guard. |
| `web/src/components/layout/SiderBar.tsx` | Grouped console navigation. |
| `web/src/components/layout/headerbar.tsx` | Header, language, theme, and user menu. |
| `web/src/components/models/MissingModelsTable.tsx` | Uncovered-model list. |
| `web/src/components/models/ModelCoverageTable.tsx` | Model-to-channel coverage table. |
| `web/src/components/models/UpstreamModelSelectModal.tsx` | Upstream model discovery and selection. |
| `web/src/components/security/AdminOAuthBindingModal.tsx` | Admin inspection/removal of user OAuth bindings. |
| `web/src/components/security/EmailBindingModal.tsx` | Email-change token/code form. |
| `web/src/components/security/OAuthBindingCard.tsx` | User OAuth binding list and actions. |
| `web/src/components/security/PasskeySettingCard.tsx` | Passkey registration, status, and deletion. |
| `web/src/components/security/SecureVerificationModal.tsx` | Second-factor modal for sensitive operations. |
| `web/src/components/security/TwoFASettingCard.tsx` | 2FA setup and backup codes. |
| `web/src/components/security/useSecureVerification.tsx` | Encapsulates 2FA/Passkey secure verification. |
| `web/src/components/setup/SetupCheck.tsx` | Setup-wizard guard. |
| `web/src/components/setup/SetupWizard.tsx` | Multi-step setup wizard state machine. |
| `web/src/components/setup/components/StepNavigation.tsx` | Wizard previous/next navigation. |
| `web/src/components/setup/components/steps/AdminStep.tsx` | Administrator account form. |
| `web/src/components/setup/components/steps/CompleteStep.tsx` | Setup summary and completion page. |
| `web/src/components/setup/components/steps/DatabaseStep.tsx` | Database connection-check step. |
| `web/src/components/setup/components/steps/UsageModeStep.tsx` | Usage-mode selection step. |
| `web/src/context/Status.tsx` | Public status and bootstrap capabilities. |
| `web/src/context/Theme.tsx` | Theme persistence and switching. |
| `web/src/context/User.tsx` | Current-user state, refresh, and logout. |
| `web/src/features/settings/components/SettingsPageHeader.tsx` | Settings page heading, actions, and business-domain navigation. |
| `web/src/features/settings/sections.ts` | Settings domains, URL sections, descriptions, and navigation attributes. |
| `web/src/i18n/i18n.ts` | i18next resources and detector initialization. |
| `web/src/i18n/language.ts` | Supported-language normalization and preference priority. |
| `web/src/lib/api.ts` | All frontend API types, Axios client, and request methods. |
| `web/src/lib/format.ts` | Date, quota, and latency formatting. |
| `web/src/lib/oauth.tsx` | OAuth provider metadata, icons, and enablement checks. |
| `web/src/lib/settings-loader.ts` | Parallel settings resource loading and error isolation. |
| `web/src/lib/shared-request.ts` | In-flight deduplication and retry cleanup for one-time requests. |
| `web/src/main.tsx` | React mount, provider composition, language, and Semi UI locale sync. |
| `web/src/pages/About.tsx` | About page and site statistics. |
| `web/src/pages/Channel.tsx` | Channel administration, tests, and model discovery. |
| `web/src/pages/Chat.tsx` | Local session management and chat requests. |
| `web/src/pages/Dashboard.tsx` | Console overview. |
| `web/src/pages/Deployment.tsx` | Channel/model deployment view. |
| `web/src/pages/Home.tsx` | Public home page. |
| `web/src/pages/Log.tsx` | Usage logs and summaries. |
| `web/src/pages/Login.tsx` | Local, OAuth, Passkey, and 2FA login. |
| `web/src/pages/Midjourney.tsx` | Image-generation task view. |
| `web/src/pages/Models.tsx` | Model coverage administration. |
| `web/src/pages/NotFound.tsx` | 404 page. |
| `web/src/pages/OAuthCallback.tsx` | One-time OAuth callback handling. |
| `web/src/pages/Personal.tsx` | Profile and security center. |
| `web/src/pages/Placeholder.tsx` | Placeholder for unfinished modules. |
| `web/src/pages/Playground.tsx` | Model request playground. |
| `web/src/pages/Pricing.tsx` | Public pricing page. |
| `web/src/pages/Redemption.tsx` | Redemption-code administration. |
| `web/src/pages/Register.tsx` | Registration and pre-registration email verification. |
| `web/src/pages/Reset.tsx` | Requests password reset. |
| `web/src/pages/ResetConfirm.tsx` | Submits reset token and new password. |
| `web/src/pages/Setting.tsx` | Four-domain system settings page. |
| `web/src/pages/Setup.tsx` | First-admin setup page. |
| `web/src/pages/Subscription.tsx` | User subscription page. |
| `web/src/pages/Task.tsx` | Asynchronous task logs. |
| `web/src/pages/Token.tsx` | API-key management. |
| `web/src/pages/TopUp.tsx` | Top-up providers and orders. |
| `web/src/pages/User.tsx` | Admin user management. |
| `web/src/pages/VerifyEmail.tsx` | Account, registration, and email-change verification. |

## Adding a page

1. Create `web/src/pages/<PageName>.tsx` (replace `<PageName>` with the real component name).
2. Register it in `web/src/App.tsx`; wrap it in `PrivateRoute` or `AdminRoute` as needed.
3. Add navigation in `web/src/components/layout/SiderBar.tsx`.
4. Add request/response types to `web/src/lib/api.ts`.
5. Route visible copy through `useTranslation()`.
6. Add behavior and translation-resource tests.

## Development and verification

```bash
bun install --cwd web
bun run --cwd web dev
npm run build:web
npm test -- --run test/i18n.test.ts
```

Full verification:

```bash
npm run build
npm run build:web
npm test
```
