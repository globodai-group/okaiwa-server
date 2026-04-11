import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import { MessageQueueService } from '#app/services/message_queue_service'

/**
 * WebSocketController manages real-time encrypted message delivery.
 *
 * SECURITY CONTRACT:
 * - WebSocket frames carry opaque encrypted blobs ONLY.
 * - The server NEVER inspects frame content.
 * - No message content is logged, cached, or stored beyond the
 *   TTL-bound Redis queue.
 * - Connection metadata (IP, user-agent) is NOT correlated with
 *   device identifiers in any persistent store.
 * - Idle connections are terminated after IDLE_TIMEOUT_MS to
 *   prevent resource exhaustion attacks.
 *
 * PROTOCOL:
 * - Client authenticates via device token in the upgrade request.
 * - Server pushes new blobs as they arrive (pub/sub from Redis).
 * - Client sends acknowledgment frames to confirm delivery.
 * - Connection is stateless from the server's perspective — if it
 *   drops, the client falls back to polling GET /v1/messages/pending.
 */

/** Maximum idle time before server closes the WebSocket connection. */
const IDLE_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes

/** Maximum WebSocket frame size to prevent memory exhaustion. */
const MAX_FRAME_SIZE_BYTES = 256 * 1024 // 256 KB

/**
 * Message types for the WebSocket protocol.
 */
interface WsIncomingMessage {
  type: 'ack'
  messageId: string
}

interface WsOutgoingMessage {
  type: 'message'
  messageId: string
  blob: string
}

interface WsErrorMessage {
  type: 'error'
  code: string
  message: string
}

@inject()
export default class WebSocketController {
  constructor(private readonly messageQueue: MessageQueueService) {}

  /**
   * Handle WebSocket upgrade request.
   *
   * This method validates the device token from the upgrade headers,
   * establishes the WebSocket connection, and sets up the message
   * forwarding pipeline.
   *
   * @param ctx - AdonisJS HTTP context
   */
  async upgrade({ request, response }: HttpContext): Promise<void> {
    const deviceId = request.header('x-device-id')
    const upgradeHeader = request.header('upgrade')

    if (!deviceId) {
      response.unauthorized({ error: 'Missing device identifier' })
      return
    }

    if (upgradeHeader?.toLowerCase() !== 'websocket') {
      response.badRequest({ error: 'WebSocket upgrade required' })
      return
    }

    /**
     * STUB: In production, this integrates with the Node.js HTTP server's
     * upgrade event to establish the WebSocket connection.
     *
     * The implementation will:
     * 1. Accept the upgrade and create a WebSocket instance.
     * 2. Subscribe to the Redis pub/sub channel for this deviceId.
     * 3. Forward incoming blobs to the WebSocket client.
     * 4. Handle acknowledgment frames from the client.
     * 5. Clean up on disconnect (unsubscribe, clear timers).
     *
     * Security: The Redis subscription channel name is derived from
     * a HMAC of the deviceId, not the raw deviceId, to prevent
     * channel enumeration by a compromised Redis instance.
     */
    response.accepted({
      status: 'websocket_upgrade_required',
      protocol: 'okaiwa-relay-v1',
      maxFrameSize: MAX_FRAME_SIZE_BYTES,
      idleTimeout: IDLE_TIMEOUT_MS,
    })
  }

  /**
   * Handle an incoming WebSocket message frame.
   *
   * @param deviceId - The authenticated device identifier
   * @param data - The parsed WebSocket frame
   * @returns The outgoing message or error, or void for acks
   */
  async handleFrame(
    deviceId: string,
    data: WsIncomingMessage
  ): Promise<WsOutgoingMessage | WsErrorMessage | void> {
    switch (data.type) {
      case 'ack': {
        /**
         * Client confirms it received and decrypted the blob.
         * Immediately purge from server-side queue.
         */
        const deleted = await this.messageQueue.purge(data.messageId)
        if (!deleted) {
          return {
            type: 'error',
            code: 'MESSAGE_NOT_FOUND',
            message: 'Message already acknowledged or expired',
          }
        }
        return
      }

      default: {
        /**
         * Unknown frame type — reject without leaking protocol details.
         */
        return {
          type: 'error',
          code: 'UNKNOWN_FRAME_TYPE',
          message: 'Unsupported message type',
        }
      }
    }
  }
}
