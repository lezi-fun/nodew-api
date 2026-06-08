# Admin API

Console and administration routes are exposed under `/api`.

## Main resources

| Resource | Purpose |
| --- | --- |
| Channels | Manage upstream providers, base URLs, keys, weights, priorities, and metadata. |
| Tokens | Create and control user-facing API tokens. |
| Users | Manage accounts, roles, status, and quota-related fields. |
| Logs | Inspect relay usage and billing-oriented records. |
| Models | Inspect model availability inferred from active channels. |
| Settings | Configure runtime and console-facing behavior. |
| Check-in | Read personal check-in status and issue daily quota rewards. |
| Top-up | Create wallet top-up sessions and settle paid orders. |

## Public site content

The console exposes a small content layer through system options. Admin users can update these values from `/console/setting`; public pages read them from `/api/site`.

| Option key | Used by |
| --- | --- |
| `site_name` | Public hero, metadata, and setup configuration. |
| `site_description` | Public home and about pages. |
| `default_model` | Playground defaults and API examples. |
| `notice` | Public announcements and preview warnings. |
| `home_page_content` | Extra home page text. |
| `about` | About page body. |
| `user_agreement` | User agreement content placeholder. |
| `privacy_policy` | Privacy policy content placeholder. |

`GET /api/site` returns the public site metadata, links, content options, and a small status summary.

## Settings options

The admin settings page writes selected configuration keys through `/api/options/:key`.

Relevant account and check-in keys include:

| Option key | Purpose |
| --- | --- |
| `registration_enabled` | Allows or blocks new user registration. |
| `registration_email_verification_required` | Requires successful email verification before account creation. |
| `self_use_mode_enabled` | Hides registration and some public entry points. |
| `demo_site_enabled` | Marks the instance as a demo deployment. |
| `checkin_enabled` | Enables or disables daily check-in on the personal page. |
| `checkin_min_quota` | Minimum random quota reward for a successful daily check-in. |
| `checkin_max_quota` | Maximum random quota reward for a successful daily check-in. |
| `passkey_enabled` | Enables or disables Passkey registration and login. |
| `passkey_rp_display_name` | WebAuthn RP display name. |
| `passkey_rp_id` | WebAuthn RP ID. |
| `passkey_origins` | Allowed WebAuthn origins (comma/newline separated). |
| `passkey_allow_insecure_origin` | Whether HTTP origins are allowed for Passkey. |
| `passkey_user_verification` | WebAuthn user verification requirement. |
| `passkey_attachment_preference` | Preferred authenticator attachment type. |

## Session authentication

The web console uses the backend authentication APIs for login, registration, setup, email verification, password reset, and user profile retrieval.

### Authentication routes

- `GET /api/oauth/state`
- `GET /api/oauth/:provider`
- `POST /api/user/register`
- `POST /api/user/login`
- `POST /api/user/password/forgot`
- `POST /api/user/password/reset`
- `POST /api/user/email/verification`
- `POST /api/user/email/verify`
- `POST /api/user/email/bind/request`
- `POST /api/user/email/bind/verify`
- `POST /api/user/passkey/login/begin`
- `POST /api/user/passkey/login/finish`
- `GET /api/user/passkey`
- `POST /api/user/passkey/register/begin`
- `POST /api/user/passkey/register/finish`
- `POST /api/user/passkey/verify/begin`
- `POST /api/user/passkey/verify/finish`
- `DELETE /api/user/passkey`
- `POST /api/verify`
- `POST /api/user/2fa/disable`
- `POST /api/user/2fa/backup-codes`
- `GET /api/user/self`
- `PATCH /api/user/self`

### Third-party login routes

- `GET /api/oauth/state?provider=github|discord|linuxdo|oidc|{custom-slug}` creates a signed OAuth state cookie and returns the provider authorize URL.
- `GET /api/oauth/:provider` consumes the OAuth callback, logs in an existing binding, creates a user when registration is enabled, or binds the identity when the request already carries an authenticated session.
- `GET /api/user/oauth/bindings` returns the current user's bound third-party accounts.
- `DELETE /api/user/oauth/bindings/:provider` removes the current user's provider binding.
- `GET /api/users/:id/oauth/bindings` returns a specific user's bound third-party accounts for admin inspection.
- `DELETE /api/users/:id/oauth/bindings/:provider` removes a specific user's provider binding from the admin console.
- Supported providers are `github`, `discord`, `linuxdo`, `oidc`, and enabled custom provider slugs.
- `GET /api/options/oauth/status` returns admin-only OAuth configuration status.
- `GET /api/options/oauth/config` returns the editable OIDC OAuth configuration.
- `PUT /api/options/oauth/config` saves the editable OIDC OAuth configuration.
- `POST /api/options/oauth/oidc/discover` fetches OIDC endpoints from a Well-Known discovery URL.
- `GET /api/options/oauth/custom-providers` lists custom OAuth provider configurations.
- `POST /api/options/oauth/custom-providers` creates a custom OAuth provider configuration.
- `PUT /api/options/oauth/custom-providers/:id` updates a custom OAuth provider configuration.
- `DELETE /api/options/oauth/custom-providers/:id` deletes a custom OAuth provider configuration.
- `POST /api/options/oauth/custom-providers/discover` fetches endpoints for a custom OAuth provider from a Well-Known discovery URL.
- Custom provider configuration fields are used by the runtime callback flow: field mappings extract user info, `authStyle` controls token credential delivery, and `accessPolicy` can reject accounts before login or binding.

### Email binding routes

- `POST /api/user/email/bind/request` sends a verification mail to the new address for the authenticated user and stores a short-lived pending bind record.
- `POST /api/user/email/bind/verify` completes the authenticated user's email change with either the mail-link token or the verification code.

### Check-in routes

- `GET /api/checkin/status`
- `POST /api/checkin`

`GET /api/checkin/status` returns whether check-in is enabled, whether the current user already checked in today, the configured min/max quota range, monthly records, cumulative totals, and streak data.

`POST /api/checkin` creates the current day's record and increments the user's remaining quota by a random value inside the configured range.

### Wallet top-up routes

- `GET /api/user/topup/stripe/config`
- `GET /api/user/topup/creem/config`
- `POST /api/user/topup/stripe/checkout`
- `POST /api/user/topup/creem/checkout`
- `POST /api/user/topup/stripe/webhook`

`GET /api/user/topup/stripe/config` returns the current Stripe wallet top-up status for signed-in users. It includes whether the feature is enabled, the currency, the quota credited per unit, the price per unit, and the minimum unit count.

`GET /api/user/topup/creem/config` returns the current Creem wallet top-up readiness and normalized fixed-product catalog for signed-in users. It never returns the Creem API key or webhook secret.

`POST /api/user/topup/stripe/checkout` accepts `{ "units": number }`, creates a pending top-up order, creates a Stripe Checkout Session, stores the Stripe session ID, and returns the Checkout URL.

`POST /api/user/topup/creem/checkout` accepts `{ "productId": string }`, validates the product against the normalized Creem catalog, creates a pending top-up order, creates a Creem Checkout Session, stores the Creem checkout/request/order identifiers, and returns the Checkout URL.

`POST /api/user/topup/stripe/webhook` is called by Stripe. It verifies the `Stripe-Signature` header against the raw request body before processing events. Paid Checkout events credit quota exactly once; expired or failed events update the pending order status without crediting quota.

## User security admin operations

- `DELETE /api/users/:id/2fa` force-disables a user's 2FA and deletes all remaining backup codes.
- `DELETE /api/users/:id/passkey` resets a user's Passkey binding.

## Shared secure verification

`POST /api/verify` creates a short-lived signed verification window for sensitive self-service actions.

- `method: "2fa"` accepts a current TOTP code or an unused backup code.
- `method: "passkey"` requires a successful `POST /api/user/passkey/verify/finish` call first, then extends the same verification window.
- The current self-service sensitive routes protected by this window are:
  - `POST /api/user/2fa/disable`
  - `POST /api/user/2fa/backup-codes`
  - `DELETE /api/user/passkey`

## Compatibility routes

Several dashboard compatibility surfaces are implemented to keep the admin console usable while the backend continues to converge on the full feature set.
