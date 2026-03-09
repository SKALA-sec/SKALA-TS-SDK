/// <reference path="../bun-test.d.ts" />

import { describe, expect, it, mock } from 'bun:test'
import { Skala } from '../src/client'

const SCORE_REQ = { event_type: 'signup' as const, ip: '1.2.3.4', email: 'err@test.com' }

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

    await expect(skala.score(SCORE_REQ)).rejects.toThrow('status 401')
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

    await expect(skala.score(SCORE_REQ)).rejects.toThrow('status 422')
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

    await expect(skala.score(SCORE_REQ)).rejects.toThrow('status 403')
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

    await expect(skala.score(SCORE_REQ)).rejects.toThrow('status 500')
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

    await expect(skala.score(SCORE_REQ)).rejects.toThrow('status 502')
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

    await expect(
      skala.outcome({ request_id: 'req_bad', outcome: 'confirmed_fraud' })
    ).rejects.toThrow('status 404')
  })
})
