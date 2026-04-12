/**
 * FCM (Firebase Cloud Messaging) service for data-only messages.
 *
 * SECURITY CONTRACT:
 * - This service sends DATA-ONLY messages — NO notification payload.
 * - FCM distinguishes between "notification messages" (visible to user)
 *   and "data messages" (handled silently by the app).
 * - We use ONLY data messages with a minimal wake-up signal.
 * - The data payload contains a single field: { "action": "sync" }.
 *   This tells the app to connect to the relay server for pending messages.
 * - NO message content, sender info, or conversation data is included.
 *
 * WHY DATA-ONLY:
 * FCM "notification messages" are processed by Google Play Services
 * on the device and may be logged by Google. "Data messages" are
 * delivered directly to the app and are NOT processed by Play Services.
 * This minimizes Google's visibility into our notification content.
 *
 * FCM PROTOCOL:
 * We use the FCM HTTP v1 API (fcm.googleapis.com/v1/projects/{project}/messages:send).
 * Authentication is via a Google service account credential.
 * The service account key should have ONLY the "Firebase Cloud Messaging API" role.
 *
 * AUDIT NOTE: The payload construction in sendDataOnlyMessage() is the
 * critical security boundary. Any addition of a "notification" field
 * MUST be rejected during security review.
 */

/** FCM HTTP v1 API endpoint. */
const FCM_API_BASE = 'https://fcm.googleapis.com/v1'

/** FCM message priority. */
const MESSAGE_PRIORITY = 'high'

/**
 * FCM message TTL (time-to-live) in seconds.
 * Set to 0: do not store the message if the device is offline.
 * The relay server handles offline message delivery — FCM is
 * only a wake-up signal.
 */
const MESSAGE_TTL = '0s'

export class FcmService {
  private readonly projectId: string
  private readonly serviceAccountKeyPath: string

  constructor() {
    this.projectId = process.env.FCM_PROJECT_ID ?? ''
    this.serviceAccountKeyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS ?? ''
  }

  /**
   * Send a data-only message to an Android device via FCM.
   *
   * The message contains ZERO notification payload. It is a
   * "data message" with a single field indicating the app should
   * sync with the relay server.
   *
   * CRITICAL SECURITY BOUNDARY:
   * The FCM message MUST NOT contain a "notification" field.
   * Only the "data" field is included, with a minimal wake-up signal.
   *
   * DO NOT ADD:
   * - "notification" object (would be visible to Google and the user)
   * - "title" / "body" (would display notification text)
   * - Message content, sender info, or any conversation metadata
   *
   * @param deviceToken - The FCM registration token
   * @throws Error with code 'INVALID_TOKEN' if the token is rejected
   */
  async sendDataOnlyMessage(deviceToken: string): Promise<void> {
    /**
     * FCM message payload.
     *
     * IMPORTANT: There is NO "notification" key in this message.
     * Only "data" is included. This makes it a "data message" that
     * is handled silently by the app without any user-visible UI.
     *
     * The "action": "sync" field tells the client app to connect
     * to the relay server and fetch pending messages. No other
     * information is transmitted.
     */
    const message = {
      message: {
        token: deviceToken,

        /**
         * Data payload: minimal wake-up signal.
         * All values must be strings (FCM data payload requirement).
         */
        data: {
          action: 'sync',
        },

        /**
         * Android-specific configuration.
         */
        android: {
          /**
           * High priority ensures the message is delivered immediately
           * even if the device is in Doze mode. This is critical for
           * real-time messaging.
           */
          priority: MESSAGE_PRIORITY,

          /**
           * TTL = 0: Do not store the message if the device is offline.
           * The relay server handles offline delivery. Stale FCM
           * messages would cause unnecessary syncs.
           */
          ttl: MESSAGE_TTL,
        },

        /**
         * SECURITY: There is deliberately NO "notification" field here.
         * A "notification" field would:
         * 1. Be visible to Google's FCM infrastructure.
         * 2. Be displayed to the user (leaking that a message arrived).
         * 3. Be stored in the device's notification tray.
         *
         * By omitting it, the message is entirely invisible to the user
         * and to Google's notification processing pipeline.
         */
      },
    }

    const accessToken = await this.getAccessToken()
    const url = `${FCM_API_BASE}/projects/${this.projectId}/messages:send`

    /**
     * TODO: Implement HTTP POST to FCM API.
     *
     * Request:
     * POST {url}
     * Authorization: Bearer {accessToken}
     * Content-Type: application/json
     * Body: JSON.stringify(message)
     *
     * Response:
     * - 200: Success, returns message name
     * - 400: Invalid request
     * - 404: Invalid token (app uninstalled or token expired)
     * - 429: Rate limited by FCM
     *
     * On 404 or token-related errors, throw with code 'INVALID_TOKEN'
     * so the caller can clean up the stale registration.
     */
    void url
    void accessToken
    void message
  }

  /**
   * Get an OAuth2 access token for the FCM API.
   *
   * Uses the Google service account credentials to obtain
   * a short-lived access token via the OAuth2 token endpoint.
   *
   * @returns A valid OAuth2 access token
   */
  private async getAccessToken(): Promise<string> {
    /**
     * TODO: Implement Google OAuth2 token exchange.
     *
     * 1. Read the service account key from `this.serviceAccountKeyPath`
     *    (resolved from GOOGLE_APPLICATION_CREDENTIALS).
     * 2. Create a JWT assertion with:
     *    - iss: service account email
     *    - scope: https://www.googleapis.com/auth/firebase.messaging
     *    - aud: https://oauth2.googleapis.com/token
     *    - exp: now + 3600
     * 3. Exchange the JWT for an access token via:
     *    POST https://oauth2.googleapis.com/token
     *    grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer
     *    assertion={jwt}
     * 4. Cache the token until expiry.
     */
    void this.serviceAccountKeyPath
    return ''
  }
}
