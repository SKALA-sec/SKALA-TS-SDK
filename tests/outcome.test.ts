/// <reference path="../bun-test.d.ts" />

import { describe, expect, it, mock } from 'bun:test'
import { Skala } from '../src/client'
import { SkalaNetworkError, SkalaTimeoutError } from '../src/errors'

describe('Skala.outcome', () => {
  it('reports a confirmed fraud outcome', async () => {
    const fetchMock = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe('https://api.skala.dev/v1/outcome')
      expect(init?.method).toBe('POST')
      expect(JSON.parse(String(init?.body))).toEqual({
        request_id: 'req_123',
        outcome: 'confirmed_fraud',
      })

      return new Response(JSON.stringify({ ok: true, identifiers_updated: 4 }), { status: 200 })
    })

    const skala = new Skala({
      apiKey: 'sk_test_123',
      fetch: fetchMock as typeof fetch,
    })

    const result = await skala.outcome({
      request_id: 'req_123',
      outcome: 'confirmed_fraud',
    })

    expect(result).toEqual({ ok: true, identifiers_updated: 4 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('reports a false_positive outcome', async () => {
    const fetchMock = mock(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(JSON.parse(String(init?.body)).outcome).toBe('false_positive')
      return new Response(JSON.stringify({ ok: true, identifiers_updated: 1 }), { status: 200 })
    })

    const skala = new Skala({
      apiKey: 'sk_test',
      fetch: fetchMock as typeof fetch,
    })

    const result = await skala.outcome({
      request_id: 'req_456',
      outcome: 'false_positive',
    })

    expect(result.ok).toBe(true)
  })

  it('reports a converted outcome', async () => {
    const fetchMock = mock(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(JSON.parse(String(init?.body)).outcome).toBe('converted')
      return new Response(JSON.stringify({ ok: true, identifiers_updated: 2 }), { status: 200 })
    })

    const skala = new Skala({
      apiKey: 'sk_test',
      fetch: fetchMock as typeof fetch,
    })

    const result = await skala.outcome({
      request_id: 'req_789',
      outcome: 'converted',
    })

    expect(result.identifiers_updated).toBe(2)
  })

  it('throws on timeout without fallback', async () => {
    const fetchMock = mock(() => new Promise<Response>(() => {}))

    const skala = new Skala({
      apiKey: 'sk_test',
      fetch: fetchMock as typeof fetch,
      timeoutMs: 50,
    })

    await expect(skala.outcome({ request_id: 'req_1', outcome: 'confirmed_fraud' })).rejects.toBeInstanceOf(
      SkalaTimeoutError
    )
  })

  it('throws a network error when API is unreachable', async () => {
    const fetchMock = mock(() => Promise.reject(new TypeError('fetch failed')))

    const skala = new Skala({
      apiKey: 'sk_test',
      fetch: fetchMock as typeof fetch,
    })

    await expect(skala.outcome({ request_id: 'req_2', outcome: 'converted' })).rejects.toBeInstanceOf(
      SkalaNetworkError
    )
  })
})
