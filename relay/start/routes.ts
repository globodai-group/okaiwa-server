import router from '@adonisjs/core/services/router'

const MessageRelayController = () => import('#app/controllers/message_relay_controller')
const WebSocketController = () => import('#app/controllers/websocket_controller')

/**
 * Relay service routes — message transit only.
 *
 * SECURITY INVARIANT: No route in this service ever inspects, decrypts,
 * or logs the content of message blobs. Every blob is an opaque byte
 * sequence from the server's perspective.
 */

router.group(() => {
  /**
   * POST /v1/messages/send
   *
   * Accepts an encrypted blob and queues it for the recipient device.
   * The blob is stored in Redis with a 7-day TTL and automatically
   * purged after expiry or delivery acknowledgment.
   *
   * Body: { recipientDeviceId: string, blob: string (base64), messageId: string }
   */
  router.post('/messages/send', [MessageRelayController, 'send'])

  /**
   * GET /v1/messages/pending
   *
   * Returns all pending encrypted blobs for the authenticated device.
   * Blobs are returned in FIFO order. The client is expected to
   * acknowledge each blob after successful decryption.
   */
  router.get('/messages/pending', [MessageRelayController, 'pending'])

  /**
   * DELETE /v1/messages/:id
   *
   * Acknowledges delivery of a specific message. The corresponding
   * blob is IMMEDIATELY and PERMANENTLY deleted from the queue.
   * There is no undo — this is intentional for privacy.
   */
  router.delete('/messages/:id', [MessageRelayController, 'acknowledge'])

  /**
   * WebSocket /v1/ws
   *
   * Real-time bidirectional channel for instant message delivery.
   * Encrypted blobs are forwarded without inspection.
   * Falls back to polling via GET /v1/messages/pending.
   */
  router.get('/ws', [WebSocketController, 'upgrade'])

}).prefix('/v1')

/**
 * Health check — returns 200 if service is alive.
 * No sensitive information is exposed.
 */
router.get('/health', async ({ response }) => {
  return response.ok({ status: 'ok', service: 'relay' })
})
