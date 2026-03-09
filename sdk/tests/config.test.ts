/// <reference path="../bun-test.d.ts" />

import { describe, expect, it, mock } from 'bun:test'
import { Skala } from '../src/client'

const okScore = () =>
  new Response(
    JSON.stringify({
      request_id: 'req_1',
      risk_score: 0,
      decision: 'allow',
      reason_codes: [],
      latency_ms: 5,
    }),
    { status: 200 }
  )

describe('configuration', () => {
  it('defaults to https://api.skala.dev', async () => {
    const fetchMock = mock(async (input: RequestInfo | URL) => {
      expect(String(input)).toBe('https://api.skala.dev/v1/score')
      return okScore()
    })

    const skala = new Skala({
      apiKey: 'sk_test',
      fetch: fetchMock as typeof fetch,
    })

    await skala.score({ event_type: 'signup', ip: '1.2.3.4', email: 'a@b.com' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('strips trailing slashes from baseUrl', async () => {
    const fetchMock = mock(async (input: RequestInfo | URL) => {
      expect(String(input)).toBe('https://api.test/v1/score')
      return okScore()
    })

    const skala = new Skala({
      apiKey: 'sk_test',
      baseUrl: 'https://api.test///',
      fetch: fetchMock as typeof fetch,
    })

    await skala.score({ event_type: 'signup', ip: '1.2.3.4', email: 'a@b.com' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('sets Authorization header with Bearer prefix', async () => {
    const fetchMock = mock(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const headers = init?.headers as Record<string, string>
      expect(headers['Authorization']).toBe('Bearer sk_my_key_123')
      return okScore()
    })

    const skala = new Skala({
      apiKey: 'sk_my_key_123',
      fetch: fetchMock as typeof fetch,
    })

    await skala.score({ event_type: 'checkout', ip: '10.0.0.1', email: 'x@y.com' })
  })

  it('uses custom timeout value for fallback', async () => {
    const fetchMock = mock(() => new Promise<Response>(() => {}))

    const skala = new Skala({
      apiKey: 'sk_test',
      fetch: fetchMock as typeof fetch,
      timeoutMs: 50,
    })

    const result = await skala.score({
      event_type: 'signup',
      ip: '1.2.3.4',
      email: 'slow@test.com',
    })

    expect(result).toMatchObject({
      fallback: true,
      decision: 'allow',
      latency_ms: 50,
    })
  })

  it('sends JSON content-type header', async () => {
    const fetchMock = mock(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const headers = init?.headers as Record<string, string>
      expect(headers['Content-Type']).toBe('application/json')
      return okScore()
    })

    const skala = new Skala({
      apiKey: 'sk_test',
      fetch: fetchMock as typeof fetch,
    })

    await skala.score({ event_type: 'login', ip: '10.0.0.1', email: 'a@b.com' })
  })

  it('sends X-Request-ID header as UUID', async () => {
    const fetchMock = mock(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const headers = init?.headers as Record<string, string>
      expect(headers['X-Request-ID']).toMatch(/^[0-9a-f-]{36}$/i)
      return okScore()
    })

    const skala = new Skala({
      apiKey: 'sk_test',
      fetch: fetchMock as typeof fetch,
    })

    await skala.score({ event_type: 'login', ip: '10.0.0.1', email: 'a@b.com' })
  })
})
