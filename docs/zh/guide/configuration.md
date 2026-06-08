# 配置说明

NodEW-api 通过环境变量读取运行配置。

## 核心变量

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `NODE_ENV` | 是 | `development`、`test` 或 `production`。 |
| `HOST` | 否 | 监听地址。容器或虚拟机暴露服务时使用 `0.0.0.0`。 |
| `PORT` | 否 | HTTP 服务端口。 |
| `DATABASE_URL` | 是 | Prisma 数据库连接字符串。 |
| `SESSION_SECRET` | 是 | Session 与认证状态使用的密钥。 |
| `CHANNEL_SECRET` | 建议 | 渠道凭据处理使用的密钥材料。 |
| `LOG_LEVEL` | 否 | Pino 日志级别，例如 `info` 或 `debug`。 |

## 账号安全

邮箱验证、密码重置，以及注册前邮箱验证支持通过 SMTP 或 Resend 发信。

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `APP_BASE_URL` | 启用邮件时必填 | 用于拼接验证链接和重置链接的控制台基础地址。 |
| `MAIL_PROVIDER` | 否 | `disabled`、`smtp` 或 `resend`，默认 `disabled`。 |
| `MAIL_FROM` | 启用邮件时必填 | 发信地址。 |
| `SMTP_HOST` | SMTP 必填 | SMTP 主机。 |
| `SMTP_PORT` | SMTP 必填 | SMTP 端口。 |
| `SMTP_SECURE` | SMTP 可选 | 设为 `true` 时使用隐式 TLS。 |
| `SMTP_USER` | SMTP 必填 | SMTP 用户名。 |
| `SMTP_PASS` | SMTP 必填 | SMTP 密码。 |
| `RESEND_API_KEY` | Resend 必填 | Resend API Key。 |

如果启用了“注册前验证邮箱”，则必须先保证发信功能可用。管理员也可以在系统设置页里直接保存邮件配置并发送测试邮件。

## 第三方登录

当前第三方登录支持 GitHub、Discord、LinuxDO、OIDC。内置 provider 通过环境变量配置；OIDC 也可以在后台设置页里修改。

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `APP_BASE_URL` | 启用任一第三方登录时必填 | 用于拼接 OAuth 回调地址。 |
| `GITHUB_OAUTH_CLIENT_ID` | GitHub 登录必填 | GitHub OAuth 应用的 Client ID。 |
| `GITHUB_OAUTH_CLIENT_SECRET` | GitHub 登录必填 | GitHub OAuth 应用的 Client Secret。 |
| `DISCORD_OAUTH_CLIENT_ID` | Discord 登录必填 | Discord OAuth 应用的 Client ID。 |
| `DISCORD_OAUTH_CLIENT_SECRET` | Discord 登录必填 | Discord OAuth 应用的 Client Secret。 |
| `LINUXDO_OAUTH_CLIENT_ID` | LinuxDO 登录必填 | LinuxDO OAuth 应用的 Client ID。 |
| `LINUXDO_OAUTH_CLIENT_SECRET` | LinuxDO 登录必填 | LinuxDO OAuth 应用的 Client Secret。 |
| `OIDC_OAUTH_ENABLED` | OIDC 登录可选 | 使用环境变量时显式开启或关闭 OIDC。OIDC 凭据完整时也会自动启用。 |
| `OIDC_OAUTH_WELL_KNOWN_URL` | OIDC 登录可选 | OIDC discovery 文档地址，后台设置页可用它自动获取端点。 |
| `OIDC_OAUTH_CLIENT_ID` | OIDC 登录必填 | OIDC Client ID。 |
| `OIDC_OAUTH_CLIENT_SECRET` | OIDC 登录必填 | OIDC Client Secret。 |
| `OIDC_OAUTH_AUTHORIZATION_URL` | OIDC 登录必填 | OIDC 授权端点。 |
| `OIDC_OAUTH_TOKEN_URL` | OIDC 登录必填 | OIDC token 端点。 |
| `OIDC_OAUTH_USERINFO_URL` | OIDC 登录必填 | OIDC userinfo 端点。 |
| `OIDC_OAUTH_SCOPE` | OIDC 登录可选 | 发起授权时使用的 scope，默认 `openid profile email`。 |

行为说明：

- 回调地址固定为 `APP_BASE_URL` 下的 `/oauth/github`、`/oauth/discord`、`/oauth/linuxdo`、`/oauth/oidc`。
- `GET /api/oauth/state` 会创建签名 state cookie，并返回跳转用的授权地址。
- `GET /api/oauth/:provider` 会消费回调结果；当注册开启时可自动创建账号；如果请求本身已经带有登录态，则会进入绑定模式。
- OIDC userinfo 必须返回 `sub` 和 `email`；如果提供了 `preferred_username`、`name`、`picture`、`email_verified`，系统会一并使用。
- 管理员可以在设置页保存 OIDC 凭据和端点。保存后的配置会覆盖环境变量默认值，并即时生效。
- 设置页也会保存自定义 OAuth provider 配置列表，包含 provider 元信息、端点、字段映射和访问策略占位；通用登录流会在后续步骤接入。

## 对象存储

对象存储是可选能力，默认关闭。当生成图片、视频、任务文件或后续上传资产需要跨 Serverless 函数重启持久化时再启用。

| 变量 | 启用时是否必填 | 说明 |
| --- | --- | --- |
| `STORAGE_DRIVER` | 是 | `disabled` 或 `s3`。 |
| `STORAGE_ENDPOINT` | 是 | S3 兼容 endpoint，可使用 AWS S3、Cloudflare R2、MinIO、腾讯云 COS S3 等。 |
| `STORAGE_REGION` | 否 | 请求签名使用的 region。Cloudflare R2 可使用 `auto`。 |
| `STORAGE_BUCKET` | 是 | Bucket 名称。 |
| `STORAGE_ACCESS_KEY_ID` | 是 | Access key ID。 |
| `STORAGE_SECRET_ACCESS_KEY` | 是 | Secret access key。 |
| `STORAGE_PUBLIC_BASE_URL` | 否 | 返回对象 URL 时使用的公开 CDN 或 bucket 地址。 |
| `STORAGE_FORCE_PATH_STYLE` | 否 | MinIO 或要求 path-style URL 的 endpoint 设置为 `true`。 |
| `STORAGE_PREFIX` | 否 | 对象 key 前缀，默认 `nodew`；所有存储对象都会被强制放在 `nodew/` 目录下。 |

管理员可通过 `GET /api/storage/status` 查看非敏感存储状态。接口不会返回访问密钥。

## 生产建议

`SESSION_SECRET` 和 `CHANNEL_SECRET` 应使用足够长的随机值。不要在生产环境复用开发密钥。

Vercel 和其他 Serverless 平台必须使用外部托管 PostgreSQL，不能使用 localhost 数据库。

## 开发账号

开发模式会 upsert 以下管理员账号：

```text
test@test.com / testtest
```

该过程是非破坏性的，不会删除渠道、令牌、用户或日志。
