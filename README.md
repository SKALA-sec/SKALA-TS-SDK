# Skala Node SDK

TypeScript SDK for the [Skala](https://github.com/SKALA-sec/SKALA-TS-SDK) abuse scoring API.

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

The SDK auto-allows requests when the API is unreachable so scoring never blocks your users:

```ts
const result = await skala.score({ ... });

if ('fallback' in result) {
  // API was unreachable — request was auto-allowed
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
