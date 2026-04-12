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
const appConfig = {
  appName: '@okaiwa/identity',
  appKey: process.env.APP_KEY ?? '',

  http: {
    generateRequestId: true,
    trustProxy: process.env.TRUST_PROXY === 'true',
    maxRequestBodySize: '1mb',
  },
}

export default appConfig
