export class SkalaError extends Error {
  readonly requestId?: string

  constructor(message: string, options: { requestId?: string; cause?: unknown } = {}) {
    super(message, { cause: options.cause })
    this.name = 'SkalaError'
    this.requestId = options.requestId
  }
}

export class SkalaConfigError extends SkalaError {
  constructor(message: string) {
    super(message)
    this.name = 'SkalaConfigError'
  }
}

export class SkalaTimeoutError extends SkalaError {
  readonly timeoutMs: number

  constructor(timeoutMs: number, requestId?: string, cause?: unknown) {
    super(`Skala request timed out after ${timeoutMs}ms`, { requestId, cause })
    this.name = 'SkalaTimeoutError'
    this.timeoutMs = timeoutMs
  }
}

export class SkalaNetworkError extends SkalaError {
  constructor(requestId?: string, cause?: unknown) {
    super('Skala request failed because the API is unreachable', { requestId, cause })
    this.name = 'SkalaNetworkError'
  }
}

export class SkalaApiError extends SkalaError {
  readonly status: number
  readonly body: unknown

  constructor(status: number, body: unknown, requestId?: string) {
    super(`Skala request failed with status ${status}`, { requestId })
    this.name = 'SkalaApiError'
    this.status = status
    this.body = body
  }
}
