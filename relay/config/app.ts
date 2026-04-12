import env from '#start/env'

/**
 * Relay service application configuration.
 *
 * This service handles TRANSIT ONLY — encrypted blobs pass through
 * without inspection, decryption, or persistent storage.
 */
const appConfig = {
  appName: '@okaiwa/relay',
  appKey: env.get('APP_KEY', ''),

  http: {
    generateRequestId: true,
    trustProxy: env.get('TRUST_PROXY', 'false') === 'true',
    maxRequestBodySize: '256kb',
  },
}

export default appConfig
