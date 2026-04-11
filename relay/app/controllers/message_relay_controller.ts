import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import { sendMessageValidator, pendingMessagesValidator, acknowledgeValidator } from '#app/validators/message_validator'
import { MessageQueueService } from '#app/services/message_queue_service'

/**
 * MessageRelayController handles the transit of end-to-end encrypted blobs.
 *
 * SECURITY CONTRACT:
 * - This controller NEVER decrypts, inspects, or logs message content.
 * - Blobs are treated as opaque byte sequences.
 * - No metadata about sender/recipient relationships is persisted beyond
 *   the TTL-bound queue entry required for asynchronous delivery.
 * - All queue entries auto-expire after 7 days.
 * - Delivered messages are immediately purged on acknowledgment.
 *
 * AUDIT NOTE: Any code change that introduces logging of blob content,
 * sender-recipient correlation, or removal of TTL enforcement MUST be
 * rejected during security review.
 */
@inject()
export default class MessageRelayController {
  constructor(private readonly messageQueue: MessageQueueService) {}

  /**
   * Queue an encrypted blob for delivery to a recipient device.
   *
   * The blob is stored in Redis with a strict TTL. The server has
   * no knowledge of the blob's content — it could be a text message,
   * media key, key ratchet update, or any other protocol message.
   *
   * @param ctx - AdonisJS HTTP context
   * @returns 202 Accepted with the message ID for tracking delivery status
   */
  async send({ request, response }: HttpContext): Promise<void> {
    const payload = await request.validateUsing(sendMessageValidator)

    /**
     * Security: We deliberately do NOT log the recipientDeviceId or
     * messageId in production, as this would create a correlation
     * record between sender device and recipient device.
     */
    await this.messageQueue.enqueue({
      messageId: payload.messageId,
      recipientDeviceId: payload.recipientDeviceId,
      blob: payload.blob,
    })

    response.accepted({
      messageId: payload.messageId,
      status: 'queued',
    })
  }

  /**
   * Fetch all pending encrypted blobs for the authenticated device.
   *
   * Returns blobs in FIFO order. The client MUST acknowledge each
   * blob after successful decryption to trigger server-side deletion.
   *
   * @param ctx - AdonisJS HTTP context
   * @returns Array of pending message blobs
   */
  async pending({ request, response }: HttpContext): Promise<void> {
    const { deviceId } = await request.validateUsing(pendingMessagesValidator)

    const messages = await this.messageQueue.dequeue(deviceId)

    /**
     * Security: Response contains only opaque blobs and message IDs.
     * No sender information is included — the recipient learns the
     * sender identity only by decrypting the blob (part of the
     * encrypted envelope).
     */
    response.ok({
      messages,
      count: messages.length,
    })
  }

  /**
   * Acknowledge delivery of a specific message.
   *
   * Upon acknowledgment, the blob is IMMEDIATELY and PERMANENTLY
   * deleted from the queue. There is no soft-delete, no trash,
   * no recovery mechanism. This is intentional — once the client
   * confirms it has the blob, the server's copy must be destroyed.
   *
   * @param ctx - AdonisJS HTTP context
   * @returns 204 No Content on success
   */
  async acknowledge({ params, request, response }: HttpContext): Promise<void> {
    const { id } = await request.validateUsing(acknowledgeValidator, {
      data: { id: params.id },
    })

    const deleted = await this.messageQueue.purge(id)

    if (!deleted) {
      /**
       * 404 is returned if the message was already acknowledged,
       * already expired via TTL, or never existed. We deliberately
       * do NOT distinguish between these cases to prevent enumeration.
       */
      response.notFound({ error: 'Message not found or already acknowledged' })
      return
    }

    /** 204: blob destroyed, no content to return. */
    response.noContent()
  }
}
