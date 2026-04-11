import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * DeviceAuthMiddleware verifies device authentication tokens.
 *
 * SECURITY ARCHITECTURE:
 * - Device tokens are opaque identifiers issued during device registration.
 * - Tokens do NOT contain user identity, phone numbers, or any PII.
 * - The token format is: {deviceId}.{timestamp}.{hmac}
 *   where HMAC is computed over deviceId + timestamp using the server's
 *   DEVICE_AUTH_SECRET. This prevents token forgery without exposing
 *   the secret to clients.
 * - Token verification uses constant-time comparison to prevent timing attacks.
 * - Failed auth attempts are NOT logged with device IDs to prevent
 *   building a database of valid/invalid device identifiers.
 *
 * WHY NOT JWT:
 * JWTs contain structured claims that could leak metadata if intercepted
 * or logged. Our opaque tokens carry zero semantic information — even if
 * intercepted, they reveal nothing about the user.
 */

/** Minimum acceptable token age to prevent replay of future-dated tokens. */
const MAX_TOKEN_AGE_SECONDS = 365 * 24 * 60 * 60 // 1 year

/** Paths that do not require device authentication. */
const PUBLIC_PATHS = ['/health']

export default class DeviceAuthMiddleware {
  /**
   * Verify the device authentication token.
   *
   * @param ctx - AdonisJS HTTP context
   * @param next - Next middleware in the chain
   */
  async handle({ request, response }: HttpContext, next: NextFn): Promise<void> {
    /** Skip auth for public endpoints. */
    if (PUBLIC_PATHS.includes(request.url())) {
      await next()
      return
    }

    const authHeader = request.header('authorization')

    if (!authHeader?.startsWith('Bearer ')) {
      response.unauthorized({
        error: 'Missing or malformed authorization header',
      })
      return
    }

    const token = authHeader.slice(7)
    const isValid = this.verifyToken(token)

    if (!isValid) {
      /**
       * Security: We return a generic error message regardless of
       * the failure reason (expired, malformed, bad HMAC).
       * Distinguishing failure modes would aid attackers.
       */
      response.unauthorized({
        error: 'Invalid device token',
      })
      return
    }

    /**
     * Extract the deviceId from the token and attach it to the request
     * for downstream handlers. The deviceId is the only piece of
     * information extracted — no user identity is derived.
     */
    const deviceId = this.extractDeviceId(token)
    request.updateBody({ ...request.body(), __deviceId: deviceId })
    request.headers()['x-device-id'] = deviceId

    await next()
  }

  /**
   * Verify token integrity using HMAC.
   * Uses constant-time comparison to prevent timing side-channel attacks.
   *
   * @param token - The device token in format {deviceId}.{timestamp}.{hmac}
   * @returns true if the token is valid and not expired
   */
  private verifyToken(token: string): boolean {
    const parts = token.split('.')
    if (parts.length !== 3) return false

    const [deviceId, timestampStr, providedHmac] = parts
    if (!deviceId || !timestampStr || !providedHmac) return false

    const timestamp = Number(timestampStr)
    if (Number.isNaN(timestamp)) return false

    /** Check token age — reject tokens older than MAX_TOKEN_AGE_SECONDS. */
    const now = Math.floor(Date.now() / 1000)
    if (now - timestamp > MAX_TOKEN_AGE_SECONDS) return false
    if (timestamp > now + 60) return false // 60s clock skew tolerance

    const secret = process.env.DEVICE_AUTH_SECRET
    if (!secret) {
      /**
       * CRITICAL: If the secret is not configured, reject ALL requests.
       * This fail-closed behavior prevents accidental open access.
       */
      return false
    }

    const expectedHmac = createHmac('sha256', secret)
      .update(`${deviceId}.${timestampStr}`)
      .digest('hex')

    /**
     * Constant-time comparison prevents timing attacks that could
     * reveal the HMAC character-by-character.
     */
    try {
      return timingSafeEqual(
        Buffer.from(providedHmac, 'hex'),
        Buffer.from(expectedHmac, 'hex')
      )
    } catch {
      return false
    }
  }

  /**
   * Extract the device ID from a verified token.
   *
   * @param token - The verified device token
   * @returns The device identifier
   */
  private extractDeviceId(token: string): string {
    return token.split('.')[0]!
  }
}
