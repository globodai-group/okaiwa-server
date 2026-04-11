import { defineConfig } from '@adonisjs/core/app'

/**
 * Blockchain RPC proxy service configuration.
 *
 * This service acts as an ANONYMOUS PROXY between Okaiwa clients
 * and blockchain RPC providers. It strips all identifying metadata
 * from requests before forwarding them.
 *
 * SECURITY INVARIANT: No client-identifying information (IP, User-Agent,
 * headers) is ever forwarded to the RPC provider.
 */
export default defineConfig({
  appName: '@okaiwa/blockchain',

  appKey: process.env.APP_KEY ?? '',

  http: {
    generateRequestId: true,
    trustProxy: process.env.TRUST_PROXY === 'true',
    maxRequestBodySize: '1mb',
  },

  providers: [
    () => import('@adonisjs/core/providers/app_provider'),
    () => import('@adonisjs/core/providers/http_provider'),
  ],

  /**
   * Global middleware.
   * StripMetadataMiddleware MUST run before any controller to ensure
   * identifying headers are removed before potential proxying.
   */
  middleware: [
    () => import('#app/middleware/strip_metadata_middleware'),
  ],
})
