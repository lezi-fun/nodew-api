# 配置说明

nodew-api 通过环境变量读取运行配置。

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
