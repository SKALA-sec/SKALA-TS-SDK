/// <reference path="../bun-test.d.ts" />

import { describe, expect, it, mock } from 'bun:test'
import { Skala } from '../src/client'
import { SkalaApiError } from '../src/errors'

const SCORE_REQ = { event_type: 'signup' as const, ip: '1.2.3.4', email: 'err@test.com' }
const UUID_REGEX = /^[0-9a-f-]{36}$/i

describe('error handling', () => {
  it('throws on 401 without retrying', async () => {
    const fetchMock = mock(async () => {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 })
    })

    const skala = new Skala({
      apiKey: 'bad_key',
      fetch: fetchMock as typeof fetch,
      retries: 2,
    })

    const error = await skala.score(SCORE_REQ).catch((err) => err)

    expect(error).toBeInstanceOf(SkalaApiError)
    if (error instanceof SkalaApiError) {
      expect(error.status).toBe(401)
      expect(error.body).toEqual({ error: 'unauthorized' })
      expect(error.requestId).toMatch(UUID_REGEX)
    }

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('throws on 422 without retrying', async () => {
    const fetchMock = mock(async () => {
      return new Response(JSON.stringify({ error: 'validation failed' }), { status: 422 })
    })

    const skala = new Skala({
      apiKey: 'sk_test',
      fetch: fetchMock as typeof fetch,
      retries: 2,
    })

    await expect(skala.score(SCORE_REQ)).rejects.toBeInstanceOf(SkalaApiError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('throws on 403 without retrying', async () => {
    const fetchMock = mock(async () => {
      return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 })
    })

    const skala = new Skala({
      apiKey: 'sk_test',
      fetch: fetchMock as typeof fetch,
      retries: 2,
    })

    await expect(skala.score(SCORE_REQ)).rejects.toBeInstanceOf(SkalaApiError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not retry on 429 rate limit responses', async () => {
    const fetchMock = mock(async () => {
      return new Response(JSON.stringify({ error: 'rate_limited' }), { status: 429 })
    })

    const skala = new Skala({
      apiKey: 'sk_test',
      fetch: fetchMock as typeof fetch,
      retries: 3,
    })

    const error = await skala.score(SCORE_REQ).catch((err) => err)
    expect(error).toBeInstanceOf(SkalaApiError)
    if (error instanceof SkalaApiError) {
      expect(error.status).toBe(429)
      expect(error.body).toEqual({ error: 'rate_limited' })
    }

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('exhausts retries on persistent 500 and throws', async () => {
    const fetchMock = mock(async () => {
      return new Response('internal error', { status: 500 })
    })

    const skala = new Skala({
      apiKey: 'sk_test',
      fetch: fetchMock as typeof fetch,
      retries: 2,
    })

    await expect(skala.score(SCORE_REQ)).rejects.toBeInstanceOf(SkalaApiError)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('does not retry when retries is 0', async () => {
    const fetchMock = mock(async () => {
      return new Response('error', { status: 502 })
    })

    const skala = new Skala({
      apiKey: 'sk_test',
      fetch: fetchMock as typeof fetch,
      retries: 0,
    })

    await expect(skala.score(SCORE_REQ)).rejects.toBeInstanceOf(SkalaApiError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('throws on outcome 4xx errors', async () => {
    const fetchMock = mock(async () => {
      return new Response(JSON.stringify({ error: 'not found' }), { status: 404 })
    })

    const skala = new Skala({
      apiKey: 'sk_test',
      fetch: fetchMock as typeof fetch,
    })

    await expect(skala.outcome({ request_id: 'req_bad', outcome: 'confirmed_fraud' })).rejects.toBeInstanceOf(
      SkalaApiError
    )
  })
})
