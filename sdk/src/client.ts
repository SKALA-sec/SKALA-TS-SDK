import type {
  OutcomeRequest,
  OutcomeResponse,
  ScoreFallbackResponse,
  ScoreRequest,
  ScoreResponse,
  SkalaClientOptions,
} from './types'

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

export function createSkalaClient(options: SkalaClientOptions) {
  const fetchImpl = options.fetch ?? fetch
  const retries = options.retries ?? DEFAULT_RETRIES
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS

  async function postJson<T>(path: string, payload: unknown): Promise<T> {
    const requestId = crypto.randomUUID()
    let attempt = 0

    while (true) {
      const response = await fetchWithTimeout(
        () =>
          fetchImpl(joinUrl(options.baseUrl, path), {
            method: 'POST',
            headers: buildRequestHeaders(options.apiKey, requestId),
            body: JSON.stringify(payload),
          }),
        timeoutMs
      )

      if (response.status >= 500 && response.status < 600 && attempt < retries) {
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

  return {
    async score(payload: ScoreRequest): Promise<ScoreResponse | ScoreFallbackResponse> {
      try {
        return await postJson<ScoreResponse>('/v1/score', payload)
      } catch (error) {
        if (error instanceof Error && error.message === 'SKALA_TIMEOUT') {
          return buildFallbackResponse(timeoutMs)
        }

        throw error
      }
    },

    async outcome(payload: OutcomeRequest): Promise<OutcomeResponse> {
      return postJson<OutcomeResponse>('/v1/outcome', payload)
    },
  }
}
