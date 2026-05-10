---
layout: home
hero:
  name: nodew-api
  text: Node.js edition of One API
  tagline: A TypeScript gateway for OpenAI-compatible relay, channel routing, token management, and usage logging.
  image:
    src: /logo.svg
    alt: nodew-api
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: Preview
      link: https://nodew.lezi.chat
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
nodew-api is still in early-stage development and is not recommended for production use yet. The Serverless deployment path is currently under active development.
:::

nodew-api is a Node.js and TypeScript adaptation of [One API](https://github.com/songquanpeng/one-api), built with Fastify, Prisma, React, Vite, and Semi UI.

Copyright 2026 lezi-fun Team. Licensed under the Apache License, Version 2.0.
