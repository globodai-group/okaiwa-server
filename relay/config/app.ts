import { defineConfig } from '@adonisjs/core/app'

/**
 * Relay service application configuration.
 *
 * This service handles TRANSIT ONLY — encrypted blobs pass through
 * without inspection, decryption, or persistent storage.
 */
export default defineConfig({
  /**
   * Application name used in logs and health checks.
   */
  appName: '@okaiwa/relay',

  /**
   * The application key used for signing cookies and other
   * cryptographic operations. Loaded from APP_KEY env variable.
   */
  appKey: process.env.APP_KEY ?? '',

  /**
   * HTTP server configuration.
   */
  http: {
    /**
     * Generate request IDs for tracing. These IDs are opaque and
     * MUST NOT be correlated with user identity.
     */
    generateRequestId: true,

    /**
     * Trust the first proxy in the chain. Required when behind
     * a reverse proxy (nginx, Cloudflare, etc.).
     */
    trustProxy: process.env.TRUST_PROXY === 'true',

    /**
     * Maximum request body size. Encrypted blobs are capped at 256KB
     * to prevent abuse while supporting media key bundles.
     */
    maxRequestBodySize: '256kb',
  },

  /**
   * Registered providers. Each provider boots a specific subsystem.
   */
  providers: [
    () => import('@adonisjs/core/providers/app_provider'),
    () => import('@adonisjs/core/providers/http_provider'),
    () => import('@adonisjs/redis/redis_provider'),
  ],

  /**
   * Global middleware stack applied to every HTTP request.
   * Order matters: auth before rate limiting ensures only
   * authenticated devices consume rate-limit quota.
   */
  middleware: [
    () => import('#app/middleware/device_auth_middleware'),
    () => import('#app/middleware/rate_limit_middleware'),
  ],
})
