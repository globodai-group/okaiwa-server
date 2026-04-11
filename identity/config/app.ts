import { defineConfig } from '@adonisjs/core/app'

/**
 * Identity service application configuration.
 *
 * This service manages:
 * - User registration with hashed phone numbers (NEVER plaintext).
 * - Signal Protocol pre-key bundle distribution.
 * - Privacy-preserving contact discovery via hash comparison.
 * - Public profile management.
 *
 * SECURITY INVARIANT: This service NEVER stores, receives, or
 * processes plaintext phone numbers. Only pre-hashed values
 * (SHA-256, client-side) are accepted and stored.
 */
export default defineConfig({
  appName: '@okaiwa/identity',

  appKey: process.env.APP_KEY ?? '',

  http: {
    generateRequestId: true,
    trustProxy: process.env.TRUST_PROXY === 'true',
    maxRequestBodySize: '1mb',
  },

  providers: [
    () => import('@adonisjs/core/providers/app_provider'),
    () => import('@adonisjs/core/providers/http_provider'),
    () => import('@adonisjs/lucid/database_provider'),
    () => import('@adonisjs/auth/auth_provider'),
  ],

  middleware: [],
})
