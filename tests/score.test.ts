/// <reference path="../bun-test.d.ts" />

import { describe, expect, it, mock } from 'bun:test'
import { Skala } from '../src/client'

describe('Skala.score', () => {
  it('sends a score request and returns the response', async () => {
    const fetchMock = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe('https://api.skala.dev/v1/score')
      expect(init?.method).toBe('POST')
      expect(init?.headers).toMatchObject({
        Authorization: 'Bearer sk_test_123',
        Accept: 'application/json',
        'Content-Type': 'application/json',
      })
      expect((init?.headers as Record<string, string>)['X-Request-ID']).toMatch(
        /^[0-9a-f-]{36}$/i
      )
      expect(JSON.parse(String(init?.body))).toEqual({
        event_type: 'signup',
        ip: '203.0.113.9',
        email: 'user@example.com',
        user_agent: 'Mozilla/5.0',
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

    const skala = new Skala({
      apiKey: 'sk_test_123',
      fetch: fetchMock as typeof fetch,
    })

    const result = await skala.score({
      event_type: 'signup',
      ip: '203.0.113.9',
      email: 'user@example.com',
      user_agent: 'Mozilla/5.0',
    })

    expect(result).toEqual({
      request_id: 'req_123',
      risk_score: 12,
      decision: 'allow',
      reason_codes: [],
      latency_ms: 9,
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('uses a custom baseUrl when provided', async () => {
    const fetchMock = mock(async (input: RequestInfo | URL) => {
      expect(String(input)).toBe('https://custom.api.test/v1/score')
      return new Response(
        JSON.stringify({
          request_id: 'req_1',
          risk_score: 5,
          decision: 'allow',
          reason_codes: [],
          latency_ms: 3,
        }),
        { status: 200 }
      )
    })

    const skala = new Skala({
      apiKey: 'sk_test',
      baseUrl: 'https://custom.api.test',
      fetch: fetchMock as typeof fetch,
    })

    await skala.score({
      event_type: 'login',
      ip: '10.0.0.1',
      email: 'test@test.com',
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('passes optional fields like device_id and metadata', async () => {
    const fetchMock = mock(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body))
      expect(body.device_id).toBe('device_abc')
      expect(body.form_fill_ms).toBe(1200)
      expect(body.metadata).toEqual({ plan: 'pro' })
      return new Response(
        JSON.stringify({
          request_id: 'req_2',
          risk_score: 30,
          decision: 'step_up',
          reason_codes: ['NEW_DEVICE'],
          latency_ms: 7,
        }),
        { status: 200 }
      )
    })

    const skala = new Skala({
      apiKey: 'sk_test',
      fetch: fetchMock as typeof fetch,
    })

    const result = await skala.score({
      event_type: 'trial_start',
      ip: '10.0.0.2',
      email: 'trial@example.com',
      device_id: 'device_abc',
      form_fill_ms: 1200,
      metadata: { plan: 'pro' },
    })

    expect(result.decision).toBe('step_up')
    expect(result.reason_codes).toContain('NEW_DEVICE')
  })

  it('retries 5xx errors and succeeds on the third attempt', async () => {
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

    const skala = new Skala({
      apiKey: 'sk_test_123',
      fetch: fetchMock as typeof fetch,
      retries: 2,
    })

    const result = await skala.score({
      event_type: 'signup',
      ip: '203.0.113.9',
      email: 'retry@example.com',
    })

    expect(result.decision).toBe('step_up')
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(requestIds.size).toBe(1)
  })

  it('returns allow fallback on timeout', async () => {
    const fetchMock = mock(() => new Promise<Response>(() => {}))

    const skala = new Skala({
      apiKey: 'sk_test_123',
      fetch: fetchMock as typeof fetch,
      timeoutMs: 10,
    })

    const result = await skala.score({
      event_type: 'signup',
      ip: '203.0.113.9',
      email: 'slow@example.com',
    })

    expect(result).toMatchObject({
      decision: 'allow',
      risk_score: 0,
      reason_codes: ['SDK_TIMEOUT_FALLBACK'],
      fallback: true,
    })
  })

  it('returns allow fallback when API is unreachable', async () => {
    const fetchMock = mock(() => Promise.reject(new TypeError('fetch failed')))

    const skala = new Skala({
      apiKey: 'sk_test_123',
      fetch: fetchMock as typeof fetch,
    })

    const result = await skala.score({
      event_type: 'signup',
      ip: '203.0.113.9',
      email: 'netdown@example.com',
    })

    expect(result).toMatchObject({
      decision: 'allow',
      risk_score: 0,
      reason_codes: ['SDK_NETWORK_FALLBACK'],
      fallback: true,
    })
  })
})
