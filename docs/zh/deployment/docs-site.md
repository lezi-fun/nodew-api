# 文档站部署

文档站是 `docs/` 目录下的独立 VitePress 项目。

生产地址：

<https://docs.lezi.chat>

## 本地命令

```bash
cd docs
npm install
npm run dev
npm run build
```

## GitHub Actions

仓库已包含 `.github/workflows/docs.yml`。

触发条件：

- 修改 `docs/**` 或文档 workflow 的 Pull Request。
- 修改 `docs/**` 或文档 workflow 后推送到 `main`。
- 手动触发 `workflow_dispatch`。

workflow 会始终构建 VitePress 文档。推送到 `main` 时，如果配置了以下仓库 secrets，还会自动部署到 Vercel：

| Secret | 值 |
| --- | --- |
| `VERCEL_TOKEN` | Vercel access token。 |
| `VERCEL_ORG_ID` | 从已关联项目设置中获取的 Vercel 团队或用户 ID。 |
| `VERCEL_DOCS_PROJECT_ID` | 文档站对应的 Vercel 项目 ID。 |

如果缺少这些 secrets，部署步骤会输出跳过信息并正常结束。这样可以保证 PR 和 fork 构建安全，同时保留主分支自动部署能力。
