import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * StripMetadataMiddleware removes all identifying headers from incoming
 * requests before they are processed by controllers and potentially
 * forwarded to RPC providers.
 *
 * SECURITY ARCHITECTURE:
 * When proxying requests to Alchemy/Infura/public RPCs, we MUST ensure
 * that no client-identifying information leaks to the provider. This
 * middleware strips all headers that could be used to fingerprint or
 * identify the originating client.
 *
 * HEADERS STRIPPED:
 * - X-Forwarded-For: Would reveal the client's real IP address.
 * - X-Real-IP: Same as above (alternative header used by some proxies).
 * - X-Forwarded-Proto: Reveals the protocol used by the client.
 * - X-Forwarded-Host: Reveals the original Host header.
 * - User-Agent: Fingerprints the client's browser/OS/device.
 * - Referer/Referrer: Reveals the originating page.
 * - Cookie: Session data that could identify the user.
 * - Accept-Language: Reveals the user's language preference (locale fingerprint).
 * - DNT: Ironically, Do-Not-Track can be used for fingerprinting.
 * - Via: Reveals proxy chain information.
 * - CF-Connecting-IP: Cloudflare's client IP header.
 * - True-Client-IP: Another proxy client IP header.
 * - X-Client-IP: Yet another proxy client IP header.
 * - X-Cluster-Client-IP: Cluster-level client IP.
 *
 * WHAT IS PRESERVED:
 * - Content-Type: Required for JSON-RPC requests.
 * - Content-Length: Required for request parsing.
 * - Authorization: Our own device auth token (stripped by controller before proxying).
 *
 * AUDIT NOTE: New identifying headers should be added to STRIPPED_HEADERS
 * as they are discovered. This list should be reviewed quarterly.
 */

/** Headers to strip from incoming requests. */
const STRIPPED_HEADERS: readonly string[] = [
  /** IP-revealing headers */
  'x-forwarded-for',
  'x-real-ip',
  'x-forwarded-proto',
  'x-forwarded-host',
  'x-forwarded-port',
  'x-forwarded-server',
  'cf-connecting-ip',
  'true-client-ip',
  'x-client-ip',
  'x-cluster-client-ip',
  'fastly-client-ip',
  'x-originating-ip',
  'forwarded',

  /** Fingerprinting headers */
  'user-agent',
  'referer',
  'referrer',
  'accept-language',
  'accept-encoding',
  'accept-charset',
  'dnt',
  'sec-ch-ua',
  'sec-ch-ua-mobile',
  'sec-ch-ua-platform',
  'sec-ch-ua-full-version',
  'sec-ch-ua-arch',
  'sec-ch-ua-model',
  'sec-fetch-dest',
  'sec-fetch-mode',
  'sec-fetch-site',
  'sec-fetch-user',

  /** Session/state headers */
  'cookie',
  'set-cookie',

  /** Proxy chain headers */
  'via',
  'x-amzn-trace-id',
  'x-request-id',

  /** Custom application headers that might leak identity */
  'x-correlation-id',
  'x-session-id',
] as const

export default class StripMetadataMiddleware {
  /**
   * Strip all identifying headers from the incoming request.
   *
   * This runs BEFORE any controller logic, ensuring that even if
   * a controller accidentally forwards request headers, no
   * identifying information will be present.
   *
   * @param ctx - AdonisJS HTTP context
   * @param next - Next middleware in the chain
   */
  async handle({ request }: HttpContext, next: NextFn): Promise<void> {
    /**
     * Remove each identifying header from the request.
     * We modify the underlying Node.js IncomingMessage headers
     * to ensure they cannot be accessed by any downstream code.
     */
    const rawHeaders = request.request.headers

    for (const header of STRIPPED_HEADERS) {
      delete rawHeaders[header]
    }

    /**
     * Replace User-Agent with a generic value.
     * Some RPC providers require a User-Agent header.
     * We use a generic value that reveals nothing about the client.
     */
    rawHeaders['user-agent'] = 'OkaiwaRPCProxy/1.0'

    /**
     * Security: After stripping, verify no X-Forwarded-* headers
     * remain. This catches any headers we might have missed.
     */
    for (const key of Object.keys(rawHeaders)) {
      if (key.toLowerCase().startsWith('x-forwarded')) {
        delete rawHeaders[key]
      }
    }

    await next()
  }
}
