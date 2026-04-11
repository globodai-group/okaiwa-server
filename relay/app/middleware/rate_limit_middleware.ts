import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import redis from '@adonisjs/redis/services/main'

/**
 * RateLimitMiddleware prevents abuse by enforcing per-device request limits.
 *
 * SECURITY RATIONALE:
 * - Rate limiting is applied per device token, NOT per IP address.
 *   IP-based limiting would penalize users behind shared NATs/VPNs
 *   and is ineffective against distributed attacks.
 * - Device tokens are opaque identifiers that do NOT reveal user identity.
 * - Rate limit counters use Redis with short TTL windows and are NOT
 *   persisted — they cannot be used for historical traffic analysis.
 *
 * LIMITS:
 * - Send: 60 messages per minute per device (sustained messaging).
 * - Pending: 30 requests per minute per device (polling).
 * - WebSocket: 120 frames per minute per connection.
 *
 * When a device exceeds its limit, a 429 Too Many Requests response
 * is returned with Retry-After header. No additional information
 * about the device or its history is included.
 */

/** Rate limit window duration in seconds. */
const WINDOW_SECONDS = 60

/** Maximum requests per window for message sending. */
const SEND_LIMIT = 60

/** Maximum requests per window for polling pending messages. */
const PENDING_LIMIT = 30

/** Default limit for other endpoints. */
const DEFAULT_LIMIT = 100

export default class RateLimitMiddleware {
  /**
   * Determine the rate limit for a given route.
   */
  private getLimit(routePath: string): number {
    if (routePath.includes('/messages/send')) return SEND_LIMIT
    if (routePath.includes('/messages/pending')) return PENDING_LIMIT
    return DEFAULT_LIMIT
  }

  /**
   * Execute rate limit check.
   *
   * @param ctx - AdonisJS HTTP context
   * @param next - Next middleware in the chain
   */
  async handle({ request, response }: HttpContext, next: NextFn): Promise<void> {
    const deviceId = request.header('x-device-id')

    if (!deviceId) {
      /**
       * If no device ID is present, the request will be rejected
       * by DeviceAuthMiddleware. We skip rate limiting here to
       * avoid creating Redis keys for unauthenticated requests.
       */
      await next()
      return
    }

    const routePath = request.url()
    const limit = this.getLimit(routePath)

    /**
     * Redis key format: ratelimit:{deviceId}:{window_timestamp}
     * The window timestamp truncates to WINDOW_SECONDS boundaries,
     * creating fixed windows. This is simpler than sliding windows
     * and sufficient for our abuse prevention needs.
     */
    const windowTimestamp = Math.floor(Date.now() / 1000 / WINDOW_SECONDS)
    const key = `ratelimit:${deviceId}:${windowTimestamp}`

    const current = await redis.incr(key)

    if (current === 1) {
      /**
       * First request in this window — set the TTL.
       * TTL is slightly longer than the window to handle clock skew.
       */
      await redis.expire(key, WINDOW_SECONDS + 5)
    }

    /** Set rate limit headers for client transparency. */
    response.header('X-RateLimit-Limit', String(limit))
    response.header('X-RateLimit-Remaining', String(Math.max(0, limit - current)))
    response.header('X-RateLimit-Reset', String((windowTimestamp + 1) * WINDOW_SECONDS))

    if (current > limit) {
      const retryAfter = WINDOW_SECONDS - (Math.floor(Date.now() / 1000) % WINDOW_SECONDS)

      response.header('Retry-After', String(retryAfter))
      response.tooManyRequests({
        error: 'Rate limit exceeded',
        retryAfter,
      })
      return
    }

    await next()
  }
}
