import { ExceptionHandler, type HttpContext } from '@adonisjs/core/http'
import type { StatusPageRange } from '@adonisjs/core/types/http'

/**
 * Global exception handler for the relay service.
 *
 * SECURITY CONTRACT:
 * - NEVER leak internal error details (stack traces, file paths, env vars).
 * - NEVER include request body content in error responses — it may contain
 *   encrypted blob data that should not be echoed.
 * - NEVER log request bodies — they contain encrypted user messages.
 * - All error responses use generic messages appropriate for the status code.
 * - Validation errors return field names but NOT field values.
 *
 * AUDIT NOTE: Any modification to this handler that increases error
 * verbosity MUST be reviewed for information leakage.
 */
export default class Handler extends ExceptionHandler {
  /**
   * Status page ranges map HTTP status codes to error page templates.
   * In an API service, we return JSON instead of HTML.
   */
  protected statusPages: Record<string, StatusPageRange> = {}

  /**
   * Debug mode is ALWAYS disabled in production.
   * When enabled (development only), additional error context is included.
   */
  protected debug = process.env.NODE_ENV !== 'production'

  /**
   * Handle the exception and return a sanitized JSON response.
   *
   * @param error - The thrown exception
   * @param ctx - AdonisJS HTTP context
   */
  async handle(error: Error & { status?: number; code?: string; messages?: unknown }, ctx: HttpContext): Promise<void> {
    const status = error.status ?? 500
    const { response } = ctx

    /**
     * Validation errors: return field-level errors without values.
     * The field names are part of our public API contract and are safe to expose.
     */
    if (error.code === 'E_VALIDATION_ERROR' && error.messages) {
      response.status(422).json({
        error: 'Validation failed',
        messages: error.messages,
      })
      return
    }

    /**
     * Rate limiting: return retry information.
     */
    if (status === 429) {
      response.status(429).json({
        error: 'Too many requests',
        retryAfter: response.getHeader('Retry-After'),
      })
      return
    }

    /**
     * Authentication errors: generic message only.
     * Do NOT reveal whether the device ID is unknown vs the HMAC is invalid.
     */
    if (status === 401) {
      response.status(401).json({
        error: 'Authentication required',
      })
      return
    }

    /**
     * Client errors (4xx): return the error message if it's safe.
     * For server errors (5xx): ALWAYS return a generic message.
     *
     * Security: 5xx errors may contain internal details (database
     * connection strings, Redis errors, etc.) that MUST NOT be exposed.
     */
    if (status >= 400 && status < 500) {
      response.status(status).json({
        error: error.message || 'Bad request',
      })
      return
    }

    /**
     * Server errors: generic message. In development, include the
     * error message for debugging. In production, NEVER.
     */
    response.status(500).json({
      error: this.debug ? error.message : 'Internal server error',
    })
  }

  /**
   * Report the exception for monitoring/alerting.
   *
   * SECURITY: We log the error class and status code, but NEVER the
   * request body (which may contain encrypted user data). We also
   * do NOT log headers that could contain device tokens.
   *
   * @param error - The thrown exception
   * @param ctx - AdonisJS HTTP context
   */
  async report(error: Error & { status?: number }, ctx: HttpContext): Promise<void> {
    const status = error.status ?? 500

    /**
     * Only report server errors (5xx) — client errors (4xx) are
     * expected and do not indicate system issues.
     */
    if (status >= 500) {
      console.error(
        JSON.stringify({
          level: 'error',
          status,
          errorClass: error.constructor.name,
          message: error.message,
          url: ctx.request.url(),
          method: ctx.request.method(),
          /**
           * Security: We log the URL and method for debugging,
           * but NOT headers (contain auth tokens) or body
           * (contains encrypted messages).
           */
          timestamp: new Date().toISOString(),
        })
      )
    }
  }
}
