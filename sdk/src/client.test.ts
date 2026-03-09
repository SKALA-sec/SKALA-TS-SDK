import { describe, expect, it, mock } from 'bun:test'
import { createSkalaClient } from './client'

describe('skala sdk client', () => {
  it('posts score requests and returns typed responses', async () => {
    const fetchMock = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe('https://api.skala.test/v1/score')
      expect(init?.method).toBe('POST')
      expect(init?.headers).toMatchObject({
        Authorization: 'Bearer sk_test_123',
        'Content-Type': 'application/json',
      })
      expect((init?.headers as Record<string, string>)['X-Request-ID']).toMatch(
        /^[0-9a-f-]{36}$/i
      )
      expect(JSON.parse(String(init?.body))).toEqual({
        event_type: 'signup',
        ip: '203.0.113.9',
        email_hash: 'a'.repeat(64),
        metadata: { email_domain: 'example.com' },
      })

      return new Response(
        JSON.stringify({
          request_id: 'req_123',
          risk_score: 12,
          decision: 'allow',
          reason_codes: [],
          latency_ms: 9,
        }),
        { status: 200 }
      )
    })

    const client = createSkalaClient({
      baseUrl: 'https://api.skala.test',
      apiKey: 'sk_test_123',
      fetch: fetchMock as typeof fetch,
    })

    const response = await client.score({
      event_type: 'signup',
      ip: '203.0.113.9',
      email_hash: 'a'.repeat(64),
      metadata: { email_domain: 'example.com' },
    })

    expect(response).toEqual({
      request_id: 'req_123',
      risk_score: 12,
      decision: 'allow',
      reason_codes: [],
      latency_ms: 9,
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('posts outcome reports', async () => {
    const fetchMock = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe('https://api.skala.test/v1/outcome')
      expect(init?.method).toBe('POST')
      expect((init?.headers as Record<string, string>)['X-Request-ID']).toMatch(
        /^[0-9a-f-]{36}$/i
      )
      expect(JSON.parse(String(init?.body))).toEqual({
        request_id: 'req_123',
        outcome: 'confirmed_fraud',
      })

      return new Response(JSON.stringify({ ok: true, identifiers_updated: 4 }), { status: 200 })
    })

    const client = createSkalaClient({
      baseUrl: 'https://api.skala.test',
      apiKey: 'sk_test_123',
      fetch: fetchMock as typeof fetch,
    })

    const response = await client.outcome({
      request_id: 'req_123',
      outcome: 'confirmed_fraud',
    })

    expect(response).toEqual({ ok: true, identifiers_updated: 4 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('retries transient 5xx failures twice before succeeding', async () => {
    const requestIds = new Set<string>()
    const fetchMock = mock(async () => {
      const attempt = fetchMock.mock.calls.length
      const headers = fetchMock.mock.calls[attempt - 1]?.[1]?.headers as Record<string, string>
      requestIds.add(headers['X-Request-ID'])

      if (attempt < 3) {
        return new Response(JSON.stringify({ error: 'temporary' }), { status: 503 })
      }

      return new Response(
        JSON.stringify({
          request_id: 'req_456',
          risk_score: 55,
          decision: 'step_up',
          reason_codes: ['HIGH_IP_VELOCITY'],
          latency_ms: 18,
        }),
        { status: 200 }
      )
    })

    const client = createSkalaClient({
      baseUrl: 'https://api.skala.test',
      apiKey: 'sk_test_123',
      fetch: fetchMock as typeof fetch,
      retries: 2,
    })

    const response = await client.score({
      event_type: 'signup',
      ip: '203.0.113.9',
      email_hash: 'b'.repeat(64),
    })

    expect(response.decision).toBe('step_up')
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(requestIds.size).toBe(1)
  })

  it('returns an allow fallback when the request times out', async () => {
    const fetchMock = mock(
      () =>
        new Promise<Response>(() => {
          // Intentionally unresolved.
        })
    )

    const client = createSkalaClient({
      baseUrl: 'https://api.skala.test',
      apiKey: 'sk_test_123',
      fetch: fetchMock as typeof fetch,
      timeoutMs: 10,
    })

    const response = await client.score({
      event_type: 'signup',
      ip: '203.0.113.9',
      email_hash: 'c'.repeat(64),
    })

    expect(response).toMatchObject({
      decision: 'allow',
      risk_score: 0,
      reason_codes: ['SDK_TIMEOUT_FALLBACK'],
      fallback: true,
    })
  })
})
