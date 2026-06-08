---
layout: home
hero:
  name: NodEW-api
  text: One API 的 Node.js 版本
  tagline: 面向 OpenAI 兼容中转、渠道路由、令牌管理和用量日志的 TypeScript 网关。
  image:
    src: /logo.svg
    alt: NodEW-api
  actions:
    - theme: brand
      text: 快速开始
      link: /zh/guide/getting-started
    - theme: alt
      text: 预览
      link: https://nodew.lezi.chat
    - theme: alt
      text: 使用 Vercel 部署
      link: https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Flezi-fun%2Fnodew-api
    - theme: alt
      text: GitHub
      link: https://github.com/lezi-fun/nodew-api
features:
  - title: OpenAI 兼容中转
    details: 提供 /v1 模型列表、聊天补全、Embedding、图片、音频和流式响应等标准接口。
  - title: 渠道路由
    details: 基于数据库渠道实现权重、优先级、失败重试和健康状态相关的路由能力。
  - title: 管理控制台
    details: 提供渠道、令牌、用户、日志、模型、兑换码、钱包充值、设置和操练场等后台页面。
  - title: 账号安全
    details: 支持邮箱验证、密码重置和会话管理 token 流程。
---

::: warning 初步开发中
NodEW-api 仍处于初步开发阶段，目前不建议用于生产环境。API、数据库结构、配置项和部署行为都可能在没有提前通知的情况下发生破坏性变更。欢迎贡献代码、测试反馈和 issue。
:::

NodEW-api 是 [One API](https://github.com/songquanpeng/one-api) 的 Node.js / TypeScript 版本，使用 Fastify、Prisma、React、Vite 和 Semi UI 构建。

Copyright 2026 lezi-fun Team. Licensed under the Apache License, Version 2.0.
