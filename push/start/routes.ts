import router from '@adonisjs/core/services/router'

const PushController = () => import('#app/controllers/push_controller')

/**
 * Push notification gateway routes.
 *
 * SECURITY INVARIANT:
 * - This service sends SILENT push notifications ONLY.
 * - No message content, sender information, or any other data is
 *   included in the push payload.
 * - The push notification's sole purpose is to wake the client app
 *   so it can connect to the relay server and fetch pending messages.
 * - Apple APNs: content-available = 1, no alert, no badge, no sound.
 * - Google FCM: data-only message, no notification payload.
 *
 * WHY SILENT:
 * If push notifications contained message content (even encrypted),
 * Apple/Google would have access to the ciphertext and its metadata
 * (sender, timestamp, size). Silent pushes reveal ONLY that
 * "something happened" — the client fetches details over its own
 * encrypted channel.
 */

router.group(() => {
  /**
   * POST /v1/push/send
   *
   * Send a silent push notification to a registered device.
   * The payload contains ONLY the device token and platform — no content.
   */
  router.post('/push/send', [PushController, 'sendSilentPush'])

  /**
   * POST /v1/push/register
   *
   * Register a device token (APNs or FCM) for push notifications.
   * The token is stored in association with a device ID (not user identity).
   */
  router.post('/push/register', [PushController, 'registerDevice'])

}).prefix('/v1')

/**
 * Health check.
 */
router.get('/health', async ({ response }) => {
  return response.ok({ status: 'ok', service: 'push' })
})
