# Docs Site Deployment

The documentation site is a separate VitePress project under `docs/`.

Production URL:

<https://nodew-api-docs.vercel.app>

## Local commands

```bash
cd docs
npm install
npm run dev
npm run build
```

## GitHub Actions

The repository includes `.github/workflows/docs.yml`.

It runs on:

- Pull requests that change `docs/**` or the docs workflow.
- Pushes to `main` that change `docs/**` or the docs workflow.
- Manual `workflow_dispatch`.

The workflow always builds the VitePress site. On `main`, it also deploys to Vercel when these repository secrets are configured:

| Secret | Value |
| --- | --- |
| `VERCEL_TOKEN` | Vercel access token. |
| `VERCEL_ORG_ID` | `team_Skb3rpmmBxfkRhICpHcTgphh` |
| `VERCEL_DOCS_PROJECT_ID` | `prj_sUUcDltlugzZpp1ht69t9XT5tl9S` |

If those secrets are missing, the deploy step exits successfully after printing a skip message. This keeps PR and fork builds safe while still allowing automated production deploys.
