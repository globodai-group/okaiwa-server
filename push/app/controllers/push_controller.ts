import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import { sendPushValidator, registerDeviceValidator } from '#app/validators/push_validator'
import { ApnsService } from '#app/services/apns_service'
import { FcmService } from '#app/services/fcm_service'

/**
 * PushController sends silent push notifications to wake client apps.
 *
 * SECURITY CONTRACT:
 * - Push payloads contain ZERO message content.
 * - No sender information, message preview, or any metadata is included.
 * - The only purpose is to trigger a background fetch in the client app.
 * - After receiving the silent push, the client connects to the relay
 *   server over its own encrypted channel to fetch pending messages.
 *
 * WHY THIS MATTERS:
 * Push notification services (APNs, FCM) are operated by Apple and Google.
 * Any data included in the push payload is visible to these companies.
 * By sending ZERO content, we ensure that Apple/Google learn only that
 * "a notification was sent to device X at time T" — they cannot determine:
 * - Who sent the message
 * - What the message contains
 * - Whether it's a text, media, call, or protocol message
 *
 * AUDIT NOTE: Any code change that adds content, alert text, badge count,
 * sound, or any data beyond the wake-up signal to the push payload
 * MUST be rejected during security review.
 */

/** Supported push notification platforms. */
type Platform = 'ios' | 'android'

@inject()
export default class PushController {
  constructor(
    private readonly apns: ApnsService,
    private readonly fcm: FcmService
  ) {}

  /**
   * Send a silent push notification to a registered device.
   *
   * The notification contains ZERO content — it only triggers
   * a background fetch in the client app.
   *
   * @param ctx - AdonisJS HTTP context
   * @returns 202 Accepted on success, error details on failure
   */
  async sendSilentPush({ request, response }: HttpContext): Promise<void> {
    const payload = await request.validateUsing(sendPushValidator)

    /**
     * Security: We log ONLY the platform and success/failure.
     * We do NOT log the device token (which could be correlated
     * with specific devices) or any timing information that could
     * reveal message patterns.
     */
    try {
      switch (payload.platform as Platform) {
        case 'ios': {
          await this.apns.sendSilentPush(payload.deviceToken)
          break
        }
        case 'android': {
          await this.fcm.sendDataOnlyMessage(payload.deviceToken)
          break
        }
        default: {
          response.badRequest({ error: 'Unsupported platform' })
          return
        }
      }

      response.accepted({ status: 'sent' })
    } catch (error) {
      /**
       * Security: Error responses do NOT include the device token
       * or any internal error details. We only report that the
       * push failed.
       */
      const code = error instanceof Error && 'code' in error
        ? (error as Error & { code: string }).code
        : 'UNKNOWN'

      if (code === 'INVALID_TOKEN') {
        /**
         * The device token is no longer valid (app uninstalled,
         * token rotated, etc.). Return 410 Gone so the caller
         * can clean up the stale token.
         */
        response.gone({ error: 'Device token is no longer valid' })
        return
      }

      response.internalServerError({ error: 'Push notification failed' })
    }
  }

  /**
   * Register a device token for push notifications.
   *
   * The token is associated with a device ID (not user identity).
   * This separation ensures the push server cannot correlate push
   * tokens with specific users or conversations.
   *
   * @param ctx - AdonisJS HTTP context
   * @returns 201 Created on success
   */
  async registerDevice({ request, response }: HttpContext): Promise<void> {
    const payload = await request.validateUsing(registerDeviceValidator)

    /**
     * TODO: Store the device token in the database or Redis.
     * The storage maps deviceId → { pushToken, platform }.
     * This mapping does NOT include user identity.
     *
     * Old tokens for the same deviceId should be replaced
     * (devices rotate push tokens periodically).
     */
    const _deviceToken = payload.deviceToken
    const _platform = payload.platform
    const _deviceId = payload.deviceId

    response.created({
      status: 'registered',
      deviceId: payload.deviceId,
    })
  }
}
