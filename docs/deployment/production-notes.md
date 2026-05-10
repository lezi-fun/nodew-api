# Production Notes

nodew-api is not currently recommended for production use. Treat the current deployment path as an integration preview.

## Before production use

- Separate development, test, and production databases.
- Use managed PostgreSQL with backups and monitoring.
- Rotate all channel credentials and session secrets.
- Validate streaming behavior through your target CDN or gateway.
- Add observability for function errors, upstream failures, latency, and quota accounting.
- Review token, channel, and admin permission policies.

## Serverless work

The Serverless deployment strategy is still being developed. The current Vercel configuration exists to support preview and compatibility testing while this work continues.
