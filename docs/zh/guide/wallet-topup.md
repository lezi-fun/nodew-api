# 钱包充值

钱包充值目前通过环境变量配置。对应 provider 开启后，控制台会在 `/console/topup` 展示 Stripe 和 Creem 入口。

## 能力矩阵

| Provider | 创建 Checkout | 自动入账 | 当前状态 |
| --- | --- | --- | --- |
| Stripe | 已支持 | 已支持，通过签名 webhook 入账 | 可用于一次性额度充值。 |
| Creem | 已支持 | 尚未实现 | 可以创建 Checkout Session，但支付完成不能视为已经自动入账。 |
| Waffo | 尚未实现 | 尚未实现 | 仅保留占位入口。 |

不要在生产计费中启用还没有完整入账链路的 provider，除非你已经有人工核验和补账流程。

## 共同要求

`APP_BASE_URL` 必须设置成公开控制台域名，不要带路径：

```bash
APP_BASE_URL="https://your-domain.example"
```

它会用于拼接 `/console/topup?stripe=success&order=...` 这类返回地址。Vercel 或反向代理部署时，应填写外部可访问的 HTTPS 地址，不要填写内部主机名。

开启支付入口前先执行数据库迁移：

```bash
npm run prisma:generate
npm run prisma:migrate:deploy
```

Vercel 构建命令已经通过 `npm run vercel-build` 执行 Prisma 生成和生产迁移。

## Stripe

Stripe 使用托管 Checkout Session，并通过签名 webhook 完成额度入账。

```bash
STRIPE_TOPUP_ENABLED=true
STRIPE_SECRET_KEY="sk_live_xxx"
STRIPE_WEBHOOK_SECRET="whsec_xxx"
STRIPE_CURRENCY="usd"
STRIPE_QUOTA_PER_UNIT=100000
STRIPE_UNIT_AMOUNT_CENTS=100
STRIPE_MIN_UNITS=1
```

### 流程

1. 控制台调用 `GET /api/user/topup/stripe/config`。
2. 用户提交充值份数到 `POST /api/user/topup/stripe/checkout`。
3. 后端创建待支付 `TopUpOrder` 和 Stripe Checkout Session。
4. Stripe 把用户跳回 `/console/topup`。
5. Stripe 向 `/api/user/topup/stripe/webhook` 发送 webhook。
6. 后端校验 `Stripe-Signature`，把订单标记为已支付，并且只为该订单增加一次用户剩余额度。

### Webhook 事件

Stripe webhook endpoint 配置为：

```text
https://your-domain.example/api/user/topup/stripe/webhook
```

后端处理以下事件：

| 事件 | 行为 |
| --- | --- |
| `checkout.session.completed` | 当 `payment_status` 为 `paid` 时入账。 |
| `checkout.session.async_payment_succeeded` | 延迟支付方式成功后入账。 |
| `checkout.session.expired` | 把待支付订单标记为已过期。 |
| `checkout.session.async_payment_failed` | 把待支付订单标记为失败。 |

已支付 webhook 重复投递是幂等的。只有订单仍处于待支付状态时才会入账。

## Creem

Creem 使用固定金额产品。`CREEM_PRODUCTS` 中的每一项用于把 Creem 产品 ID 映射到本系统中的额度和展示金额。

```bash
CREEM_TOPUP_ENABLED=true
CREEM_API_KEY="creem_xxx"
CREEM_WEBHOOK_SECRET="creem_whsec_xxx"
CREEM_TEST_MODE=false
CREEM_PRODUCTS='[{"productId":"prod_xxx","name":"100k quota","quotaAmount":100000,"amountCents":1000,"currency":"usd"}]'
```

`CREEM_PRODUCTS` 兼容以下字段：

| 标准字段 | 兼容字段 | 说明 |
| --- | --- | --- |
| `productId` | `product_id` | Creem 产品 ID。 |
| `quotaAmount` | `quota` | 后续入账时增加的额度。 |
| `amountCents` | `priceCents`、小数 `price` | 产品金额，单位是对应货币的最小单位。 |
| `currency` | 无 | 货币代码，默认 `usd`。 |

### 流程

1. 控制台调用 `GET /api/user/topup/creem/config`。
2. 用户选择一个已配置的固定产品。
3. 控制台调用 `POST /api/user/topup/creem/checkout`，请求体为 `{ "productId": "prod_xxx" }`。
4. 后端创建待支付 `TopUpOrder` 和 Creem Checkout Session。
5. Creem 把用户跳回 `/console/topup`。

Creem webhook 入账尚未实现。在它完成前，用户从 Creem 成功返回并不会自动增加额度。

## 排障

| 现象 | 检查项 |
| --- | --- |
| 支付方式显示不可用 | 确认对应 enable 变量为 `true`，`APP_BASE_URL` 已设置，并且 provider secret 存在。 |
| Stripe Checkout 创建失败 | 检查 `STRIPE_SECRET_KEY`、货币、单价，以及迁移是否已经执行。 |
| Stripe 支付返回后额度没变 | 检查 Stripe webhook endpoint 是否配置、可访问，并且 `STRIPE_WEBHOOK_SECRET` 匹配。 |
| Creem 产品列表为空 | 检查 `CREEM_PRODUCTS` 是否是合法 JSON，且每个产品都有 product ID、额度和金额。 |
| Creem Checkout 成功但额度没变 | 当前符合预期；Creem webhook 入账仍在待实现阶段。 |

## API 摘要

| 路由 | 鉴权 | 用途 |
| --- | --- | --- |
| `GET /api/user/topup/stripe/config` | 用户 session | 读取 Stripe 充值状态。 |
| `POST /api/user/topup/stripe/checkout` | 用户 session | 创建 Stripe Checkout Session。 |
| `POST /api/user/topup/stripe/webhook` | Stripe 签名 | 处理 Stripe 支付事件并入账。 |
| `GET /api/user/topup/creem/config` | 用户 session | 读取 Creem 可用状态和固定产品。 |
| `POST /api/user/topup/creem/checkout` | 用户 session | 为已配置产品创建 Creem Checkout Session。 |
