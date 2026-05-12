# Security Policy

## Supported Versions

NodEW-api is in early-stage development. Security fixes are applied to the `main` branch unless a stable release branch is announced.

| Version | Supported |
| --- | --- |
| `main` | Yes |
| Earlier snapshots | No |

## Reporting a Vulnerability

Please do not open a public issue for sensitive vulnerabilities.

Use GitHub Security Advisories when available, or contact the maintainers through the repository owner profile with:

- Affected commit or version.
- Reproduction steps.
- Impact and affected endpoints.
- Any known mitigation.

We will review valid reports as soon as possible. Because the project is still in early development, APIs, database schemas, configuration, and deployment behavior may receive breaking changes while a fix is being prepared.

## Scope

Reports are most useful when they affect:

- Authentication or session handling.
- API key validation.
- Relay request isolation.
- Usage accounting or quota enforcement.
- Admin-only API access.
- Secret handling, storage, or logging.
