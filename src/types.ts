export type SkalaEventType =
  | 'signup'
  | 'login'
  | 'trial_start'
  | 'checkout'
  | 'api_key_create'

export type SkalaDecision = 'allow' | 'step_up' | 'block'
export type SkalaOutcome = 'confirmed_fraud' | 'false_positive' | 'converted'

export interface ScoreRequest {
  event_type: SkalaEventType
  ip: string
  email: string
  device_id?: string
  user_agent?: string
  form_fill_ms?: number
  metadata?: Record<string, unknown>
}

export interface ScoreResponse {
  request_id: string
  risk_score: number
  decision: SkalaDecision
  reason_codes: string[]
  latency_ms: number
}

export interface ScoreFallbackResponse extends ScoreResponse {
  fallback: true
}

export interface OutcomeRequest {
  request_id: string
  outcome: SkalaOutcome
}

export interface OutcomeResponse {
  ok: boolean
  identifiers_updated: number
}

export interface SkalaOptions {
  apiKey: string
  baseUrl?: string
  fetch?: typeof globalThis.fetch
  retries?: number
  timeoutMs?: number
}
