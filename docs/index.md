---
layout: home
hero:
  name: NodEW-api
  text: Node.js edition of One API
  tagline: A TypeScript gateway for OpenAI-compatible relay, channel routing, token management, and usage logging.
  image:
    src: /logo.svg
    alt: NodEW-api
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: Preview
      link: https://nodew.lezi.chat
    - theme: alt
      text: Deploy with Vercel
      link: https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Flezi-fun%2Fnodew-api
    - theme: alt
      text: GitHub
      link: https://github.com/lezi-fun/nodew-api
features:
  - title: OpenAI-compatible relay
    details: Provides standard /v1 endpoints for model lists, chat completions, embeddings, images, audio, and streaming responses.
  - title: Channel routing
    details: Routes requests through database-backed channels with weights, priorities, retries, and health-oriented metadata.
  - title: Admin console
    details: Includes a web console for channels, tokens, users, logs, models, redemptions, settings, and playground workflows.
---

::: warning Early development
NodEW-api is still in early-stage development and is not recommended for production use yet. APIs, database schemas, configuration, and deployment behavior may receive breaking changes at any time without prior notice. Contributions, testing feedback, and issue reports are welcome.
:::

NodEW-api is a Node.js and TypeScript adaptation of [One API](https://github.com/songquanpeng/one-api), built with Fastify, Prisma, React, Vite, and Semi UI.

Copyright 2026 lezi-fun Team. Licensed under the Apache License, Version 2.0.
