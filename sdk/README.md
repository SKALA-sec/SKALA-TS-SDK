# Skala SDK

Small TypeScript SDK for calling the Skala Worker API from Node or Bun.

## Install

```bash
bun add skala
npm install skala
```

## Usage

```ts
import { createSkalaClient } from 'skala'

const client = createSkalaClient({
  baseUrl: 'https://api.example.com',
  apiKey: 'sk_live_...',
})

const result = await client.score({
  event_type: 'signup',
  ip: '203.0.113.10',
  email_hash: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
})
```
