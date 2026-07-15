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
| Check-in | 读取个人签到状态并发放每日随机额度。 |
| Top-up | 创建钱包充值会话并处理已支付订单入账。 |
| Subscriptions | 管理可购买的订阅套餐，并查看当前用户的订阅记录。 |

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
- `GET /api/oauth/:provider`
- `POST /api/user/register`
- `POST /api/user/login`
- `POST /api/user/password/forgot`
- `POST /api/user/password/reset`
- `POST /api/user/email/verification`
- `POST /api/user/email/verify`
- `POST /api/user/email/bind/request`
- `POST /api/user/email/bind/verify`
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

- `GET /api/oauth/state?provider=github|discord|linuxdo|oidc|{custom-slug}` 创建签名 state cookie，并返回对应 provider 的授权跳转地址。
- `GET /api/oauth/:provider` 消费 OAuth 回调：已有绑定时直接登录；注册开启时可自动创建账号；如果请求已带登录态则进入绑定模式。
- `GET /api/user/oauth/bindings` 返回当前用户已绑定的第三方账号列表。
- `DELETE /api/user/oauth/bindings/:provider` 解绑当前用户的指定 provider 账号。
- `GET /api/users/:id/oauth/bindings` 供管理员查看指定用户已绑定的第三方账号列表。
- `DELETE /api/users/:id/oauth/bindings/:provider` 供管理员在控制台解绑指定用户的指定 provider 账号。
- 当前支持的 provider 是 `github`、`discord`、`linuxdo`、`oidc`，以及已启用的自定义 provider slug。
- `GET /api/options/oauth/status` 返回管理员可见的 OAuth 配置状态。
- `GET /api/options/oauth/config` 返回可编辑的 OIDC OAuth 配置。
- `PUT /api/options/oauth/config` 保存可编辑的 OIDC OAuth 配置。
- `POST /api/options/oauth/oidc/discover` 根据 Well-Known discovery URL 获取 OIDC 端点。
- `GET /api/options/oauth/custom-providers` 返回自定义 OAuth provider 配置列表。
- `POST /api/options/oauth/custom-providers` 创建自定义 OAuth provider 配置。
- `PUT /api/options/oauth/custom-providers/:id` 更新自定义 OAuth provider 配置。
- `DELETE /api/options/oauth/custom-providers/:id` 删除自定义 OAuth provider 配置。
- `POST /api/options/oauth/custom-providers/discover` 根据 Well-Known discovery URL 获取自定义 OAuth provider 端点。
- 自定义 provider 配置会参与运行时回调流程：字段映射用于提取用户信息，`authStyle` 控制 token 凭据传递方式，`accessPolicy` 可以在登录或绑定前拒绝账号。

### 邮箱绑定路由

- `POST /api/user/email/bind/request` 为当前登录用户向新邮箱发送验证邮件，并保存一条短时有效的待绑定记录。
- `POST /api/user/email/bind/verify` 支持当前登录用户使用邮件链接 token 或验证码完成邮箱换绑。

### 签到路由

- `GET /api/checkin/status`
- `POST /api/checkin`

`GET /api/checkin/status` 返回签到是否开启、当前用户今日是否已签到、后台配置的随机奖励范围、月历记录、累计统计和连签数据。

`POST /api/checkin` 会创建当天签到记录，并按后台配置的随机区间增加用户剩余额度。

### 钱包充值路由

- `GET /api/user/topup/stripe/config`
- `GET /api/user/topup/creem/config`
- `GET /api/user/topup/waffo/config`
- `POST /api/user/topup/stripe/checkout`
- `POST /api/user/topup/creem/checkout`
- `POST /api/user/topup/stripe/webhook`
- `POST /api/user/topup/creem/webhook`

`GET /api/user/topup/stripe/config` 返回当前登录用户可见的 Stripe 钱包充值状态，包括是否启用、货币、每份入账额度、每份价格和最小购买份数。

`GET /api/user/topup/creem/config` 返回当前登录用户可见的 Creem 钱包充值准备状态和规范化后的固定产品目录，不会返回 Creem API Key 或 webhook secret。

`POST /api/user/topup/stripe/checkout` 接收 `{ "units": number }`，创建待支付充值订单，创建 Stripe Checkout Session，保存 Stripe session ID，并返回 Checkout URL。

`POST /api/user/topup/creem/checkout` 接收 `{ "productId": string }`，先按规范化后的 Creem 产品目录校验产品，再创建待支付充值订单和 Creem Checkout Session，保存 Creem checkout/request/order 标识，并返回 Checkout URL。

`POST /api/user/topup/stripe/webhook` 由 Stripe 调用。后端会先使用原始请求体和 `Stripe-Signature` 头完成签名校验，再处理事件。已支付 Checkout 事件只会入账一次；过期或失败事件只更新待支付订单状态，不增加额度。

`POST /api/user/topup/creem/webhook` 由 Creem 调用。后端会先使用原始请求体和 `creem-signature` 头完成签名校验，再处理事件。已支付 `checkout.completed` 事件只会入账一次；未支付或不支持的订单类型会返回成功但不增加额度。

### 订阅路由

- `GET /api/subscription/plans` 返回当前登录用户可购买的已启用套餐。
- `POST /api/subscription/stripe/checkout` 接收 `{ "planId": string }`，为已启用套餐创建 Stripe Checkout Session。
- `GET /api/subscription/self` 返回当前用户的有效订阅和历史订阅记录。
|- `GET /api/subscription/admin/plans` 供管理员查看全部套餐，包括已停用套餐。
|- `POST /api/subscription/admin/plans` 使用 `{ "plan": SubscriptionPlan }` 创建套餐。
|- `PUT /api/subscription/admin/plans/:id` 更新套餐，并以路径中的 ID 为准。
|- `DELETE /api/subscription/admin/plans/:id` 删除套餐。
|- `POST /api/subscription/admin/bind/:userId` 为指定用户绑定订阅套餐。接收 `{ "planId": string, "quotaOverride"?: number, "status"?: "ACTIVE"|"EXPIRED", "startAt"?: ISO 日期, "endAt"?: ISO 日期|null }`。绑定时会向用户账户注入额度，并在 settings 中以 `provider: "ADMIN"` 记录订阅。

订阅套餐保存在 `subscription_plans` 系统配置中。后台设置页提供结构化编辑器，可管理套餐 ID、展示文案、价格、币种、入账额度、有效期、特性、启用状态和排序权重。停用套餐仍会保留在管理员列表中，但不会出现在用户购买接口里。

## 兼容接口

当前已经实现多个控制台兼容接口，用于在后端继续补齐功能时保持管理界面可用。
