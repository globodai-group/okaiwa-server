import vine from '@vinejs/vine'

/**
 * Push notification validators.
 *
 * SECURITY:
 * - Device tokens are validated for format to prevent injection attacks.
 * - Platform must be one of the supported enum values.
 * - NO message content fields are accepted — the push service
 *   intentionally has no way to include message data in notifications.
 */

/**
 * Token format reference (for documentation):
 * - APNs device token: 64 hex characters (32 bytes).
 *   Example: "740f4707bebcf74f9b7c25d48e3358945f6aa01da5ddb387462c7eaf61bb78ad"
 * - FCM registration token: variable length alphanumeric string.
 *   Typically 100-300 characters.
 *
 * Validation is done by length range to support both platforms.
 */

/**
 * Validator for POST /v1/push/send
 *
 * Note the absence of any "content", "message", "title", "body",
 * or "data" fields. The push service INTENTIONALLY does not accept
 * any message content. The only input is the device token and platform.
 */
export const sendPushValidator = vine.compile(
  vine.object({
    /**
     * The platform-specific push token.
     * - iOS: APNs device token (64 hex chars)
     * - Android: FCM registration token (alphanumeric, 100-512 chars)
     */
    deviceToken: vine.string().minLength(64).maxLength(512),

    /**
     * Target platform.
     * Determines which push service (APNs or FCM) to use.
     */
    platform: vine.enum(['ios', 'android'] as const),
  })
)

/**
 * Validator for POST /v1/push/register
 *
 * Associates a platform push token with a device ID.
 * The device ID is opaque and does NOT reveal user identity.
 */
export const registerDeviceValidator = vine.compile(
  vine.object({
    /**
     * Opaque device identifier.
     * This is the same device ID used by the relay service.
     * It does NOT contain or reveal user identity.
     */
    deviceId: vine.string().regex(/^[a-zA-Z0-9\-]{32,128}$/),

    /**
     * Platform-specific push token.
     */
    deviceToken: vine.string().minLength(64).maxLength(512),

    /**
     * Target platform.
     */
    platform: vine.enum(['ios', 'android'] as const),
  })
)
