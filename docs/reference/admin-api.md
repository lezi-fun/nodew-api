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

## Session authentication

The web console uses the backend authentication APIs for login, registration, setup, and user profile retrieval.

## Compatibility routes

Several dashboard compatibility surfaces are implemented to keep the admin console usable while the backend continues to converge on the full feature set.
