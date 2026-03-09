import {
  SkalaApiError,
  SkalaConfigError,
  SkalaNetworkError,
  SkalaTimeoutError,
} from './errors.js'
import type {
  OutcomeRequest,
  OutcomeResponse,
  ScoreFallbackResponse,
  ScoreRequest,
  ScoreResponse,
  SkalaOptions,
} from './types.js'

const DEFAULT_BASE_URL = 'https://api.skala.dev'
const DEFAULT_RETRIES = 2
const DEFAULT_TIMEOUT_MS = 5_000

type FallbackReasonCode = 'SDK_TIMEOUT_FALLBACK' | 'SDK_NETWORK_FALLBACK'

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, '')}${path}`
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function createRequestId(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function buildFallbackResponse(
  requestId: string,
  latencyMs: number,
  reasonCode: FallbackReasonCode
): ScoreFallbackResponse {
  return {
    request_id: requestId,
    risk_score: 0,
    decision: 'allow',
    reason_codes: [reasonCode],
    latency_ms: Math.max(0, Math.round(latencyMs)),
    fallback: true,
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

async function fetchWithTimeout(
  request: (signal: AbortSignal) => Promise<Response>,
  timeoutMs: number,
  requestId: string
): Promise<Response> {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort()
      reject(new SkalaTimeoutError(timeoutMs, requestId))
    }, timeoutMs)
  })

  try {
    return await Promise.race([request(controller.signal), timeoutPromise])
  } catch (error) {
    if (isAbortError(error)) {
      throw new SkalaTimeoutError(timeoutMs, requestId, error)
    }

    throw error
  } finally {
    if (timer) {
      clearTimeout(timer)
    }
  }
}

function buildRequestHeaders(apiKey: string, requestId: string): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-Request-ID': requestId,
  }
}

async function parseErrorBody(response: Response): Promise<unknown> {
  const text = await response.text()

  if (text.length === 0) {
    return undefined
  }

  try {
    return JSON.parse(text) as unknown
  } catch (_parseError) {
    return text
  }
}

export class Skala {
  private readonly baseUrl: string
  private readonly apiKey: string
  private readonly fetchImpl: typeof fetch
  private readonly retries: number
  private readonly timeoutMs: number

  constructor(options: SkalaOptions) {
    if (!options.apiKey || options.apiKey.trim().length === 0) {
      throw new SkalaConfigError('Skala apiKey is required')
    }

    if (options.retries !== undefined && options.retries < 0) {
      throw new SkalaConfigError('Skala retries must be greater than or equal to 0')
    }

    if (options.timeoutMs !== undefined && options.timeoutMs <= 0) {
      throw new SkalaConfigError('Skala timeoutMs must be greater than 0')
    }

    this.apiKey = options.apiKey
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL
    this.fetchImpl = options.fetch ?? fetch
    this.retries = options.retries ?? DEFAULT_RETRIES
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  }

  private async postJson<T>(path: string, payload: unknown): Promise<T> {
    const requestId = createRequestId()
    let attempt = 0

    while (true) {
      let response: Response

      try {
        response = await fetchWithTimeout(
          (signal) =>
            this.fetchImpl(joinUrl(this.baseUrl, path), {
              method: 'POST',
              headers: buildRequestHeaders(this.apiKey, requestId),
              body: JSON.stringify(payload),
              signal,
            }),
          this.timeoutMs,
          requestId
        )
      } catch (error) {
        if (error instanceof SkalaTimeoutError) {
          throw error
        }

        throw new SkalaNetworkError(requestId, error)
      }

      if (response.status >= 500 && response.status < 600 && attempt < this.retries) {
        attempt += 1
        await delay(50 * attempt)
        continue
      }

      if (!response.ok) {
        throw new SkalaApiError(response.status, await parseErrorBody(response), requestId)
      }

      return (await response.json()) as T
    }
  }

  async score(payload: ScoreRequest): Promise<ScoreResponse | ScoreFallbackResponse> {
    const startedAt = Date.now()

    try {
      return await this.postJson<ScoreResponse>('/v1/score', payload)
    } catch (error) {
      const elapsedMs = Date.now() - startedAt

      if (error instanceof SkalaTimeoutError) {
        return buildFallbackResponse(
          error.requestId ?? createRequestId(),
          elapsedMs,
          'SDK_TIMEOUT_FALLBACK'
        )
      }

      if (error instanceof SkalaNetworkError) {
        return buildFallbackResponse(
          error.requestId ?? createRequestId(),
          elapsedMs,
          'SDK_NETWORK_FALLBACK'
        )
      }

      throw error
    }
  }

  async outcome(payload: OutcomeRequest): Promise<OutcomeResponse> {
    return this.postJson<OutcomeResponse>('/v1/outcome', payload)
  }
}
