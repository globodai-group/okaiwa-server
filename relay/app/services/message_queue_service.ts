import redis from '@adonisjs/redis/services/main'
import { MESSAGE_TTL_SECONDS } from '#config/redis'

/**
 * MessageQueueService manages the transient encrypted message queue.
 *
 * SECURITY CONTRACT:
 * - ALL data stored by this service is encrypted end-to-end by the clients.
 * - The server treats every blob as opaque bytes — it CANNOT decrypt them.
 * - Every entry has a strict TTL (7 days). Entries auto-expire via Redis TTL.
 * - Delivered messages are immediately purged upon acknowledgment.
 * - NO message content is ever logged, sampled, or inspected.
 * - NO sender-recipient correlation is persisted beyond the queue entry.
 *
 * REDIS KEY SCHEMA:
 * - msg:{messageId}       → The encrypted blob + metadata (STRING with TTL)
 * - inbox:{deviceId}      → Sorted set of messageIds (ZSET, score = timestamp)
 *
 * The inbox ZSET enables efficient retrieval of all pending messages
 * for a device. The score is the enqueue timestamp, giving FIFO ordering.
 * Inbox entries inherit the TTL from their corresponding message keys.
 */

/**
 * Represents a queued message entry.
 */
export interface QueuedMessage {
  messageId: string
  recipientDeviceId: string
  blob: string
  /**
   * Sender's deviceId — surfaced back to the recipient on dequeue
   * so they can address SessionCipher and look up the right Signal
   * session. Privacy trade-off documented in the validator.
   */
  senderDeviceId: string
  /**
   * Sender's accountId — needed by the recipient to render the
   * sender's profile on first contact (username, displayName).
   */
  senderAccountId: string
}

/**
 * Represents a message retrieved from the queue.
 */
export interface PendingMessage {
  messageId: string
  blob: string
  enqueuedAt: number
  senderDeviceId: string
  senderAccountId: string
}

export class MessageQueueService {
  /**
   * Enqueue an encrypted blob for asynchronous delivery.
   *
   * The blob is stored in Redis with a strict TTL. If the recipient
   * does not fetch it within the TTL, it is automatically and
   * permanently deleted.
   *
   * @param message - The message to enqueue
   */
  async enqueue(message: QueuedMessage): Promise<void> {
    const { messageId, recipientDeviceId, blob, senderDeviceId, senderAccountId } = message
    const now = Date.now()

    const msgKey = `msg:${messageId}`
    const inboxKey = `inbox:${recipientDeviceId}`

    /**
     * Use a Redis pipeline (MULTI/EXEC) for atomicity.
     * Both the message blob and the inbox reference must be
     * created together to maintain consistency.
     */
    const pipeline = redis.multi()

    /**
     * Store the encrypted blob with TTL.
     * After MESSAGE_TTL_SECONDS, Redis automatically deletes this key.
     * This is the core privacy guarantee: no indefinite storage.
     */
    pipeline.set(
      msgKey,
      JSON.stringify({ blob, enqueuedAt: now, senderDeviceId, senderAccountId }),
      'EX',
      MESSAGE_TTL_SECONDS
    )

    /**
     * Add to the recipient's inbox sorted set.
     * Score = timestamp for FIFO ordering.
     */
    pipeline.zadd(inboxKey, now, messageId)

    /**
     * Set TTL on the inbox key itself. This ensures the inbox
     * is cleaned up even if individual message TTLs expire at
     * different times. The inbox TTL is refreshed on each enqueue.
     */
    pipeline.expire(inboxKey, MESSAGE_TTL_SECONDS)

    await pipeline.exec()

    /**
     * Publish to the Redis pub/sub channel for real-time delivery
     * via WebSocket. The channel name is the device ID.
     * Only the messageId is published — the WebSocket handler
     * fetches the blob separately, maintaining access control.
     */
    await redis.publish(`notify:${recipientDeviceId}`, messageId)
  }

  /**
   * Retrieve all pending messages for a device.
   *
   * Returns messages in FIFO order (oldest first). The messages
   * remain in the queue until explicitly acknowledged via purge().
   *
   * @param deviceId - The recipient device identifier
   * @returns Array of pending messages with their blobs
   */
  async dequeue(deviceId: string): Promise<PendingMessage[]> {
    const inboxKey = `inbox:${deviceId}`

    /** Retrieve all message IDs from the inbox, ordered by timestamp. */
    const messageIds = await redis.zrangebyscore(inboxKey, '-inf', '+inf')

    if (messageIds.length === 0) {
      return []
    }

    const messages: PendingMessage[] = []

    /**
     * Fetch each message blob. We iterate rather than using MGET
     * because some messages may have expired (TTL) while the inbox
     * reference still exists. Expired references are cleaned up.
     */
    const expiredIds: string[] = []

    for (const messageId of messageIds) {
      const raw = await redis.get(`msg:${messageId}`)

      if (raw === null) {
        /**
         * Message key expired (TTL) but inbox reference remains.
         * Mark for cleanup — this is expected behavior, not an error.
         */
        expiredIds.push(messageId)
        continue
      }

      const parsed = JSON.parse(raw) as {
        blob: string
        enqueuedAt: number
        senderDeviceId?: string
        senderAccountId?: string
      }
      messages.push({
        messageId,
        blob: parsed.blob,
        enqueuedAt: parsed.enqueuedAt,
        // Backward-compat: pre-existing entries on disk before this
        // commit landed don't have sender fields. Default to empty
        // strings so the recipient at least sees the message; the
        // mobile client treats an empty senderDeviceId as a stale
        // pre-migration entry and skips the reply path.
        senderDeviceId: parsed.senderDeviceId ?? '',
        senderAccountId: parsed.senderAccountId ?? '',
      })
    }

    /** Clean up expired inbox references. */
    if (expiredIds.length > 0) {
      await redis.zrem(inboxKey, ...expiredIds)
    }

    return messages
  }

  /**
   * Permanently delete a message from the queue upon delivery confirmation.
   *
   * This is the critical privacy operation: once the recipient confirms
   * they have the blob, the server's copy MUST be destroyed immediately.
   * There is no trash, no soft-delete, no recovery mechanism.
   *
   * @param messageId - The message to purge
   * @returns true if the message was found and deleted, false if already gone
   */
  async purge(messageId: string): Promise<boolean> {
    const msgKey = `msg:${messageId}`

    /**
     * First, check if the message exists and get it to find the
     * associated device inbox (we don't store the recipientDeviceId
     * in the message itself to minimize stored metadata).
     */
    const deleted = await redis.del(msgKey)

    /**
     * Note: We do NOT remove from the inbox ZSET here because we
     * don't have the recipientDeviceId. The inbox cleanup happens
     * in dequeue() when it encounters expired/deleted references.
     * This is acceptable because:
     * 1. The inbox ZSET entry is just a messageId string (no content).
     * 2. The actual blob is already deleted.
     * 3. The inbox has its own TTL for eventual cleanup.
     */

    return deleted > 0
  }
}
