# 快速开始

NodEW-api 是 [One API](https://github.com/songquanpeng/one-api) 的 Node.js / TypeScript 版本，提供 OpenAI 兼容中转、数据库渠道系统、令牌管理、用量日志和 Web 管理控制台。

::: warning 初步开发中
项目仍处于初步开发阶段，目前不建议用于生产环境。API、数据库结构、配置项和部署行为都可能在没有提前通知的情况下发生破坏性变更。
:::

## 环境要求

- Node.js 22 或更高版本
- npm
- 默认使用 PostgreSQL
- 可选：使用 MySQL Prisma schema 时支持 MySQL

## 安装依赖

```bash
npm install
cd web
npm install
cd ..
```

## 环境变量

在仓库根目录创建 `.env`：

```bash
NODE_ENV=development
HOST=0.0.0.0
PORT=3000
LOG_LEVEL=info
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/nodew_api?schema=public"
SESSION_SECRET="nodew-dev-session-secret"
CHANNEL_SECRET="nodew-dev-channel-secret"
```

可选的邮件发送配置：

```bash
APP_BASE_URL="http://127.0.0.1:3000"
MAIL_PROVIDER="smtp"
MAIL_FROM="noreply@example.com"
SMTP_HOST="smtp.example.com"
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER="smtp-user"
SMTP_PASS="smtp-password"
```

如果你要启用第三方登录，再按需补上对应 provider 的配置：

```bash
APP_BASE_URL="http://127.0.0.1:3000"
GITHUB_OAUTH_CLIENT_ID="Iv1.xxxxx"
GITHUB_OAUTH_CLIENT_SECRET="github-oauth-secret"
OIDC_OAUTH_ENABLED=true
OIDC_OAUTH_WELL_KNOWN_URL="https://id.example.com/.well-known/openid-configuration"
OIDC_OAUTH_CLIENT_ID="oidc-client-id"
OIDC_OAUTH_CLIENT_SECRET="oidc-client-secret"
OIDC_OAUTH_AUTHORIZATION_URL="https://id.example.com/oauth2/authorize"
OIDC_OAUTH_TOKEN_URL="https://id.example.com/oauth2/token"
OIDC_OAUTH_USERINFO_URL="https://id.example.com/oauth2/userinfo"
```

某个 provider 配置完整后，登录页会显示对应入口，后端会启用 `/api/oauth/state` 和 `/api/oauth/:provider` 回调链路。前端回调路径固定在同一个 `APP_BASE_URL` 下，例如 `/oauth/github` 和 `/oauth/oidc`。OIDC 凭据和端点也可以后续在后台设置页里修改。

## 初始化数据库

```bash
npm run prisma:generate
npm run prisma:migrate:deploy
```

## 启动

```bash
npm run dev
```

打开 `http://127.0.0.1:3000`。

开发环境会自动确保以下管理员账号存在，并且不会清空已有数据：

```text
邮箱：test@test.com
密码：testtest
```

## 构建

```bash
cd web
npm run build
cd ..
npm run build
npm run start
```
