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

## 生产建议

`SESSION_SECRET` 和 `CHANNEL_SECRET` 应使用足够长的随机值。不要在生产环境复用开发密钥。

Vercel 和其他 Serverless 平台必须使用外部托管 PostgreSQL，不能使用 localhost 数据库。

## 开发账号

开发模式会 upsert 以下管理员账号：

```text
test@test.com / testtest
```

该过程是非破坏性的，不会删除渠道、令牌、用户或日志。
