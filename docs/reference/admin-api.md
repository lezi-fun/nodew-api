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

- `POST /api/user/register`
- `POST /api/user/login`
- `POST /api/user/password/forgot`
- `POST /api/user/password/reset`
- `POST /api/user/email/verification`
- `POST /api/user/email/verify`
- `POST /api/user/passkey/login/begin`
- `POST /api/user/passkey/login/finish`
- `GET /api/user/passkey`
- `POST /api/user/passkey/register/begin`
- `POST /api/user/passkey/register/finish`
- `POST /api/user/passkey/verify/begin`
- `POST /api/user/passkey/verify/finish`
- `DELETE /api/user/passkey`
- `POST /api/verify`
- `GET /api/user/self`
- `PATCH /api/user/self`

### Check-in routes

- `GET /api/checkin/status`
- `POST /api/checkin`

`GET /api/checkin/status` returns whether check-in is enabled, whether the current user already checked in today, the configured min/max quota range, monthly records, cumulative totals, and streak data.

`POST /api/checkin` creates the current day's record and increments the user's remaining quota by a random value inside the configured range.

## User security admin operations

- `DELETE /api/users/:id/passkey` resets a user's Passkey binding.

## Compatibility routes

Several dashboard compatibility surfaces are implemented to keep the admin console usable while the backend continues to converge on the full feature set.
