# Relay API

Relay 接口位于 `/v1`，设计目标是兼容 OpenAI 风格客户端。

## 鉴权

使用 nodew-api 令牌作为 bearer token：

```http
Authorization: Bearer sk-...
```

## 常用接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/v1/models` | 从可用渠道列出模型。 |
| `POST` | `/v1/chat/completions` | Chat Completions，支持流式响应。 |
| `POST` | `/v1/completions` | Text Completion 兼容接口。 |
| `POST` | `/v1/embeddings` | Embedding 中转。 |
| `POST` | `/v1/responses` | Responses API 兼容接口。 |
| `POST` | `/v1/images/generations` | 图片生成中转。 |
| `POST` | `/v1/audio/speech` | 语音生成中转。 |
| `POST` | `/v1/audio/transcriptions` | 音频转写中转。 |
| `POST` | `/v1/audio/translations` | 音频翻译中转。 |

## 流式响应

流式 Chat 响应会以 SSE 方式透传。客户端应保持连接，直到收到最终事件。

```json
{
  "model": "gpt-4o-mini",
  "messages": [{ "role": "user", "content": "hello" }],
  "stream": true
}
```

## 路由

Relay 会根据请求模型、渠道状态和路由 metadata 选择渠道，并支持权重路由和失败后重试其他可用渠道。
