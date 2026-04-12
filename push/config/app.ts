/**
 * Push notification gateway configuration.
 *
 * SECURITY INVARIANT: Push notifications carry ZERO content.
 * APNs: content-available:1 only. FCM: data-only message.
 */
const appConfig = {
  appName: '@okaiwa/push',
  appKey: process.env.APP_KEY ?? '',

  http: {
    generateRequestId: true,
    trustProxy: process.env.TRUST_PROXY === 'true',
    maxRequestBodySize: '64kb',
  },
}

export default appConfig
