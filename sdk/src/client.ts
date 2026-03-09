import type {
  OutcomeRequest,
  OutcomeResponse,
  ScoreFallbackResponse,
  ScoreRequest,
  ScoreResponse,
  SkalaOptions,
} from './types'

const DEFAULT_BASE_URL = 'https://api.skala.dev'
const DEFAULT_RETRIES = 2
const DEFAULT_TIMEOUT_MS = 5_000

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, '')}${path}`
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function buildFallbackResponse(timeoutMs: number): ScoreFallbackResponse {
  return {
    request_id: 'sdk_timeout_fallback',
    risk_score: 0,
    decision: 'allow',
    reason_codes: ['SDK_TIMEOUT_FALLBACK'],
    latency_ms: timeoutMs,
    fallback: true,
  }
}

async function fetchWithTimeout(
  request: () => Promise<Response>,
  timeoutMs: number
): Promise<Response> {
  return Promise.race([
    request(),
    new Promise<Response>((_, reject) => {
      const timer = setTimeout(() => {
        clearTimeout(timer)
        reject(new Error('SKALA_TIMEOUT'))
      }, timeoutMs)
    }),
  ])
}

function buildRequestHeaders(apiKey: string, requestId: string): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'X-Request-ID': requestId,
  }
}

export class Skala {
  private readonly baseUrl: string
  private readonly apiKey: string
  private readonly fetchImpl: typeof fetch
  private readonly retries: number
  private readonly timeoutMs: number

  constructor(options: SkalaOptions) {
    this.apiKey = options.apiKey
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL
    this.fetchImpl = options.fetch ?? fetch
    this.retries = options.retries ?? DEFAULT_RETRIES
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  }

  private async postJson<T>(path: string, payload: unknown): Promise<T> {
    const requestId = crypto.randomUUID()
    let attempt = 0

    while (true) {
      const response = await fetchWithTimeout(
        () =>
          this.fetchImpl(joinUrl(this.baseUrl, path), {
            method: 'POST',
            headers: buildRequestHeaders(this.apiKey, requestId),
            body: JSON.stringify(payload),
          }),
        this.timeoutMs
      )

      if (response.status >= 500 && response.status < 600 && attempt < this.retries) {
        attempt += 1
        await delay(50 * attempt)
        continue
      }

      if (!response.ok) {
        throw new Error(`Skala request failed with status ${response.status}`)
      }

      return (await response.json()) as T
    }
  }

  async score(payload: ScoreRequest): Promise<ScoreResponse | ScoreFallbackResponse> {
    try {
      return await this.postJson<ScoreResponse>('/v1/score', payload)
    } catch (error) {
      if (error instanceof Error && error.message === 'SKALA_TIMEOUT') {
        return buildFallbackResponse(this.timeoutMs)
      }

      throw error
    }
  }

  async outcome(payload: OutcomeRequest): Promise<OutcomeResponse> {
    return this.postJson<OutcomeResponse>('/v1/outcome', payload)
  }
}
