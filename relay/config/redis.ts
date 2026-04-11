import { defineConfig } from '@adonisjs/redis'

/**
 * Redis configuration for the relay message queue.
 *
 * SECURITY ARCHITECTURE:
 * - Redis is used as a volatile queue with strict TTL enforcement.
 * - Every queued blob auto-expires after MESSAGE_TTL_SECONDS (default: 7 days).
 * - Once a recipient acknowledges delivery, the blob is IMMEDIATELY deleted.
 * - No persistence (RDB/AOF) is recommended in production — if Redis restarts,
 *   queued blobs are lost, which is the CORRECT privacy-preserving behavior.
 *   Recipients will re-request from the sender via the protocol.
 */

/**
 * Maximum time-to-live for queued messages: 7 days in seconds.
 * After this period, undelivered blobs are automatically purged.
 * This prevents indefinite storage of encrypted data.
 */
export const MESSAGE_TTL_SECONDS = 7 * 24 * 60 * 60 // 604800 seconds = 7 days

export default defineConfig({
  connection: 'main',

  connections: {
    main: {
      host: process.env.REDIS_HOST ?? '127.0.0.1',
      port: Number(process.env.REDIS_PORT ?? 6379),
      password: process.env.REDIS_PASSWORD ?? undefined,
      db: Number(process.env.REDIS_DB ?? 0),

      /**
       * TLS is REQUIRED in production to prevent eavesdropping on
       * the link between relay and Redis. Even though blobs are
       * end-to-end encrypted, TLS prevents metadata leakage
       * (e.g., which device IDs have pending messages).
       */
      ...(process.env.NODE_ENV === 'production' && {
        tls: {
          rejectUnauthorized: true,
        },
      }),

      /**
       * Key prefix isolates relay data from other services
       * that may share the same Redis instance.
       */
      keyPrefix: 'okaiwa:relay:',

      /**
       * Connection retry strategy with exponential backoff.
       * Max 10 retries before giving up.
       */
      retryStrategy(times: number): number | null {
        if (times > 10) return null
        return Math.min(times * 200, 5000)
      },
    },
  },
})
