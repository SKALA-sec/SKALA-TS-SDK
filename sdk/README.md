# Skala Node SDK

TypeScript SDK for the [Skala](https://github.com/SKALA-sec/SKALA-TS-SDK) abuse scoring API.

## Install

```bash
npm install @skala/node
```

## Quick Start

```ts
import { createSkalaClient } from '@skala/node'

const skala = createSkalaClient({
  baseUrl: 'https://api.skala.dev',
  apiKey: 'sk_live_...',
})
```

## Score a Request

```ts
const result = await skala.score({
  event_type: 'signup',
  ip: '203.0.113.10',
  email_hash: '0123456789abcdef...',
})

if (result.decision === 'block') {
  // reject the request
} else if (result.decision === 'step_up') {
  // require additional verification
}
```

## Report an Outcome

After confirming fraud or a false positive, report the outcome so future scoring improves:

```ts
await skala.outcome({
  request_id: result.request_id,
  outcome: 'confirmed_fraud', // or 'false_positive' | 'converted'
})
```

## Timeout & Fallback

The SDK returns a safe `allow` fallback if the API is unreachable, so scoring never blocks your users:

```ts
const result = await skala.score({ ... })

if ('fallback' in result) {
  // API was unreachable — request was auto-allowed
}
```

## Configuration

| Option | Default | Description |
|---|---|---|
| `baseUrl` | — | Skala API base URL |
| `apiKey` | — | Your API key |
| `timeoutMs` | `5000` | Request timeout in ms |
| `retries` | `2` | Retry count for 5xx errors |
| `fetch` | global `fetch` | Custom fetch implementation |

## License

MIT
