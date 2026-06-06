# 管理 API

控制台和管理接口位于 `/api`。

## 主要资源

| 资源 | 用途 |
| --- | --- |
| Channels | 管理上游供应商、Base URL、密钥、权重、优先级和 metadata。 |
| Tokens | 创建和控制用户侧 API 令牌。 |
| Users | 管理账号、角色、状态和额度相关字段。 |
| Logs | 查看中转用量和面向计费的记录。 |
| Models | 查看从可用渠道推导出的模型列表。 |
| Settings | 配置运行时和控制台展示行为。 |

## 公开站点内容

控制台提供一层轻量内容配置。管理员可以在 `/console/setting` 修改这些值，公开页面通过 `/api/site` 读取。

| 配置键 | 用途 |
| --- | --- |
| `site_name` | 公开首页、元信息和初始化配置。 |
| `site_description` | 公开首页和关于页面。 |
| `default_model` | 操练场默认值和 API 示例。 |
| `notice` | 公开公告和预览环境提示。 |
| `home_page_content` | 首页补充内容。 |
| `about` | 关于页面正文。 |
| `user_agreement` | 用户协议内容预留。 |
| `privacy_policy` | 隐私政策内容预留。 |

`GET /api/site` 会返回公开站点元信息、链接、内容配置和简要运行状态。

## Session 鉴权

Web 控制台使用后端认证接口完成登录、注册、初始化和用户信息读取。

### 认证路由

- `GET /api/oauth/state`
- `GET /api/oauth/github`
- `POST /api/user/register`
- `POST /api/user/login`
- `POST /api/user/password/forgot`
- `POST /api/user/password/reset`
- `POST /api/user/email/verification`
- `POST /api/user/email/verify`
- `POST /api/user/passkey/login/begin`
- `POST /api/user/passkey/login/finish`
- `GET /api/user/passkey`
- `POST /api/user/passkey/register/begin`
- `POST /api/user/passkey/register/finish`
- `POST /api/user/passkey/verify/begin`
- `POST /api/user/passkey/verify/finish`
- `DELETE /api/user/passkey`
- `POST /api/verify`
- `POST /api/user/2fa/disable`
- `POST /api/user/2fa/backup-codes`
- `GET /api/user/self`
- `PATCH /api/user/self`

### 第三方登录路由

- `GET /api/oauth/state?provider=github` 创建签名 state cookie，并返回 GitHub 授权跳转地址。
- `GET /api/oauth/github` 消费 OAuth 回调：已有绑定时直接登录；注册开启时可自动创建账号；如果请求已带登录态则进入绑定模式。
- `GET /api/user/oauth/bindings` 返回当前用户已绑定的第三方账号列表。
- `DELETE /api/user/oauth/bindings/github` 解绑当前用户的 GitHub 账号。
- `GET /api/users/:id/oauth/bindings` 供管理员查看指定用户已绑定的第三方账号列表。
- `DELETE /api/users/:id/oauth/bindings/github` 供管理员在控制台解绑指定用户的 GitHub 账号。
- 当前只实现了 GitHub provider，但路由形状已经按后续多 provider 扩展预留。

## 兼容接口

当前已经实现多个控制台兼容接口，用于在后端继续补齐功能时保持管理界面可用。
