import { createHmac, timingSafeEqual } from 'node:crypto'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import env from '#start/env'

/**
 * SessionAuthMiddleware verifies identity-service session tokens.
 *
 * SECURITY ARCHITECTURE
 * - Tokens are HMAC-signed by `AuthController.generateSessionToken`
 *   in the shape `{accountId}.{timestamp}.{hmac}`. The HMAC is
 *   computed over `accountId.timestamp` with `IDENTITY_SESSION_SECRET`.
 *   Distinct from the relay's `DEVICE_AUTH_SECRET` so a leaked secret
 *   on one service cannot forge sessions on the other.
 * - Tokens are stateless — no DB lookup. The accountId is part of the
 *   payload and authenticated by the HMAC. Revocation lands when the
 *   sessions table arrives (separate sprint).
 * - Constant-time comparison via `timingSafeEqual` to defeat the
 *   HMAC-character-by-character timing attack.
 * - Failed-auth responses are intentionally generic ("Invalid session
 *   token") — distinguishing failure modes (expired, malformed, bad
 *   HMAC, missing secret) would help an attacker enumerate.
 *
 * TOKEN LIFETIME
 * The expiry is checked against `MAX_TOKEN_AGE_SECONDS` (1h, matching
 * the `expiresIn` value the controller returns). Refresh re-issues a
 * fresh token, so legitimate clients never hit the wall.
 *
 * CALLER CONTRACT
 * On success the resolved `accountId` is attached to `ctx.auth` so
 * downstream controllers can `ctx.auth.accountId` instead of trusting
 * a header. We deliberately do NOT also attach the raw token to the
 * context — controllers should never need it.
 */

/** Maximum acceptable token age (matches `expiresIn` in the controller). */
const MAX_TOKEN_AGE_SECONDS = 60 * 60

declare module '@adonisjs/core/http' {
  interface HttpContext {
    auth?: { accountId: string }
  }
}

export default class SessionAuthMiddleware {
  async handle(ctx: HttpContext, next: NextFn): Promise<void> {
    const authHeader = ctx.request.header('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      ctx.response.unauthorized({ error: 'Missing or malformed authorization header' })
      return
    }

    const token = authHeader.slice(7)
    const accountId = this.verifyToken(token)
    if (!accountId) {
      ctx.response.unauthorized({ error: 'Invalid session token' })
      return
    }

    ctx.auth = { accountId }
    await next()
  }

  /**
   * Verify token integrity and recency. Returns the embedded accountId
   * on success, null on any failure mode.
   */
  private verifyToken(token: string): string | null {
    const parts = token.split('.')
    if (parts.length !== 3) return null

    const [accountId, timestampStr, providedHmac] = parts
    if (!accountId || !timestampStr || !providedHmac) return null

    const timestamp = Number(timestampStr)
    if (Number.isNaN(timestamp)) return null

    const now = Math.floor(Date.now() / 1000)
    if (now - timestamp > MAX_TOKEN_AGE_SECONDS) return null
    if (timestamp > now + 60) return null // 60s clock skew tolerance

    const secret = env.get('IDENTITY_SESSION_SECRET')
    if (!secret) {
      // Fail closed: if the secret is missing, the server is
      // misconfigured — reject every request so production deploys
      // that lose the secret don't accidentally turn open.
      return null
    }

    const expectedHmac = createHmac('sha256', secret)
      .update(`${accountId}.${timestampStr}`)
      .digest('hex')

    try {
      const ok = timingSafeEqual(
        Buffer.from(providedHmac, 'hex'),
        Buffer.from(expectedHmac, 'hex')
      )
      return ok ? accountId : null
    } catch {
      return null
    }
  }
}
