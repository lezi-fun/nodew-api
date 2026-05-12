# Relay API

Relay endpoints are exposed under `/v1` and are designed to be compatible with OpenAI-style clients.

## Authentication

Use a NodEW-api token as a bearer token:

```http
Authorization: Bearer sk-...
```

## Common endpoints

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/v1/models` | List available models from active channels. |
| `POST` | `/v1/chat/completions` | Chat completions, including streaming. |
| `POST` | `/v1/completions` | Text completion compatibility. |
| `POST` | `/v1/embeddings` | Embedding relay. |
| `POST` | `/v1/responses` | Responses API compatibility. |
| `POST` | `/v1/images/generations` | Image generation relay. |
| `POST` | `/v1/audio/speech` | Speech relay. |
| `POST` | `/v1/audio/transcriptions` | Audio transcription relay. |
| `POST` | `/v1/audio/translations` | Audio translation relay. |

## Streaming

Streaming chat responses are proxied as server-sent events. Clients should keep the upstream connection open until the final event is received.

```json
{
  "model": "gpt-4o-mini",
  "messages": [{ "role": "user", "content": "hello" }],
  "stream": true
}
```

## Routing

The relay selects channels by requested model, channel state, and routing metadata. It supports weighted routing and retrying another eligible channel after a failed upstream request.
