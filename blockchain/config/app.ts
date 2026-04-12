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
const appConfig = {
  appName: '@okaiwa/blockchain',
  appKey: process.env.APP_KEY ?? '',

  http: {
    generateRequestId: true,
    trustProxy: process.env.TRUST_PROXY === 'true',
    maxRequestBodySize: '1mb',
  },
}

export default appConfig
