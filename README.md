# Skala Node SDK

TypeScript SDK for the [Skala](https://github.com/SKALA-sec/SKALA-TS-SDK) abuse scoring API.

Requires Node 18+ or Bun 1.0+.

## Install

```bash
npm install @skalaio/node
```

## Quick Start

```ts
import { Skala } from '@skalaio/node';

const skala = new Skala({ apiKey: 'sk_live_...' });

const result = await skala.score({
  event_type: 'signup',
  ip: req.ip,
  email: body.email,
  user_agent: req.headers['user-agent'],
});

if (result.decision === 'block') {
  return res.status(403).json({ error: 'Request blocked' });
}

if (result.decision === 'step_up') {
  return res.status(200).json({ requires_verification: true });
}
```

## Report an Outcome

Feed back fraud signals to improve future scoring:

```ts
await skala.outcome({
  request_id: result.request_id,
  outcome: 'confirmed_fraud',
});
```

## Timeout Fallback

`score()` auto-allows when the API is unreachable (timeout or network failure), so scoring does not block user traffic.

HTTP API responses (for example 4xx/5xx) still throw errors.

```ts
const result = await skala.score({ ... });

if ('fallback' in result) {
  // request was auto-allowed by SDK fallback
  // result.reason_codes is SDK_TIMEOUT_FALLBACK or SDK_NETWORK_FALLBACK
}
```

## Error Handling

Use structured SDK errors for predictable handling:

```ts
import {
  Skala,
  SkalaApiError,
  SkalaNetworkError,
  SkalaTimeoutError,
} from '@skalaio/node';

try {
  await skala.outcome({ request_id: 'req_123', outcome: 'confirmed_fraud' });
} catch (error) {
  if (error instanceof SkalaTimeoutError) {
    // request timed out
  } else if (error instanceof SkalaNetworkError) {
    // API unreachable (DNS/TLS/connectivity)
  } else if (error instanceof SkalaApiError) {
    // API returned non-2xx
    console.error(error.status, error.body, error.requestId);
  } else {
    throw error;
  }
}
```

## Configuration

```ts
const skala = new Skala({
  apiKey: 'sk_live_...',
  baseUrl: 'https://api.skala.dev', // default
  timeoutMs: 5000,                  // default
  retries: 2,                       // default, only retries 5xx
});
```

## License

MIT
