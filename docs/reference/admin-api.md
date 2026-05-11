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

## Session authentication

The web console uses the backend authentication APIs for login, registration, setup, and user profile retrieval.

## Compatibility routes

Several dashboard compatibility surfaces are implemented to keep the admin console usable while the backend continues to converge on the full feature set.
