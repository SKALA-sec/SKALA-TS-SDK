/// <reference path="../bun-test.d.ts" />

import { describe, expect, it, mock } from 'bun:test'
import { createSkalaClient } from './client'

describe('client edge cases', () => {
  it('strips trailing slashes from baseUrl', async () => {
    const fetchMock = mock(async (input: RequestInfo | URL) => {
      expect(String(input)).toBe('https://api.skala.test/v1/score')
      return new Response(
        JSON.stringify({
          request_id: 'req_1',
          risk_score: 0,
          decision: 'allow',
          reason_codes: [],
          latency_ms: 5,
        }),
        { status: 200 }
      )
    })

    const client = createSkalaClient({
      baseUrl: 'https://api.skala.test///',
      apiKey: 'sk_test',
      fetch: fetchMock as typeof fetch,
    })

    await client.score({
      event_type: 'signup',
      ip: '1.2.3.4',
      email_hash: 'a'.repeat(64),
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('throws on 4xx errors without retrying', async () => {
    const fetchMock = mock(async () => {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 })
    })

    const client = createSkalaClient({
      baseUrl: 'https://api.skala.test',
      apiKey: 'bad_key',
      fetch: fetchMock as typeof fetch,
      retries: 2,
    })

    expect(
      client.score({
        event_type: 'login',
        ip: '1.2.3.4',
        email_hash: 'b'.repeat(64),
      })
    ).rejects.toThrow('status 401')

    // wait for the promise to settle
    await new Promise((r) => setTimeout(r, 10))
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('throws on 422 validation error without retrying', async () => {
    const fetchMock = mock(async () => {
      return new Response(JSON.stringify({ error: 'validation failed' }), { status: 422 })
    })

    const client = createSkalaClient({
      baseUrl: 'https://api.skala.test',
      apiKey: 'sk_test',
      fetch: fetchMock as typeof fetch,
      retries: 2,
    })

    expect(
      client.score({
        event_type: 'signup',
        ip: '1.2.3.4',
        email_hash: 'c'.repeat(64),
      })
    ).rejects.toThrow('status 422')

    await new Promise((r) => setTimeout(r, 10))
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('exhausts retries on persistent 5xx and throws', async () => {
    const fetchMock = mock(async () => {
      return new Response('internal error', { status: 500 })
    })

    const client = createSkalaClient({
      baseUrl: 'https://api.skala.test',
      apiKey: 'sk_test',
      fetch: fetchMock as typeof fetch,
      retries: 2,
    })

    await expect(
      client.score({
        event_type: 'signup',
        ip: '1.2.3.4',
        email_hash: 'd'.repeat(64),
      })
    ).rejects.toThrow('status 500')

    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('uses custom timeout value', async () => {
    const fetchMock = mock(
      () => new Promise<Response>(() => {})
    )

    const client = createSkalaClient({
      baseUrl: 'https://api.skala.test',
      apiKey: 'sk_test',
      fetch: fetchMock as typeof fetch,
      timeoutMs: 50,
    })

    const result = await client.score({
      event_type: 'signup',
      ip: '1.2.3.4',
      email_hash: 'e'.repeat(64),
    })

    expect(result).toMatchObject({
      fallback: true,
      decision: 'allow',
      latency_ms: 50,
    })
  })

  it('outcome rejects on timeout instead of returning fallback', async () => {
    const fetchMock = mock(
      () => new Promise<Response>(() => {})
    )

    const client = createSkalaClient({
      baseUrl: 'https://api.skala.test',
      apiKey: 'sk_test',
      fetch: fetchMock as typeof fetch,
      timeoutMs: 50,
    })

    await expect(
      client.outcome({ request_id: 'req_1', outcome: 'confirmed_fraud' })
    ).rejects.toThrow('SKALA_TIMEOUT')
  })

  it('sets Authorization header with Bearer prefix', async () => {
    const fetchMock = mock(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const headers = init?.headers as Record<string, string>
      expect(headers['Authorization']).toBe('Bearer sk_my_key_123')
      return new Response(
        JSON.stringify({
          request_id: 'req_1',
          risk_score: 10,
          decision: 'allow',
          reason_codes: [],
          latency_ms: 3,
        }),
        { status: 200 }
      )
    })

    const client = createSkalaClient({
      baseUrl: 'https://api.skala.test',
      apiKey: 'sk_my_key_123',
      fetch: fetchMock as typeof fetch,
    })

    await client.score({
      event_type: 'checkout',
      ip: '10.0.0.1',
      email_hash: 'f'.repeat(64),
    })
  })

  it('sends JSON content-type and stringified body', async () => {
    const fetchMock = mock(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const headers = init?.headers as Record<string, string>
      expect(headers['Content-Type']).toBe('application/json')
      const body = JSON.parse(String(init?.body))
      expect(body.event_type).toBe('trial_start')
      expect(body.device_id).toBe('device_abc')
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

    const client = createSkalaClient({
      baseUrl: 'https://api.skala.test',
      apiKey: 'sk_test',
      fetch: fetchMock as typeof fetch,
    })

    const result = await client.score({
      event_type: 'trial_start',
      ip: '10.0.0.2',
      email_hash: 'a'.repeat(64),
      device_id: 'device_abc',
    })

    expect(result.decision).toBe('step_up')
    expect(result.reason_codes).toContain('NEW_DEVICE')
  })

  it('retries zero times when retries is set to 0', async () => {
    const fetchMock = mock(async () => {
      return new Response('error', { status: 502 })
    })

    const client = createSkalaClient({
      baseUrl: 'https://api.skala.test',
      apiKey: 'sk_test',
      fetch: fetchMock as typeof fetch,
      retries: 0,
    })

    await expect(
      client.score({
        event_type: 'signup',
        ip: '1.2.3.4',
        email_hash: 'a'.repeat(64),
      })
    ).rejects.toThrow('status 502')

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
