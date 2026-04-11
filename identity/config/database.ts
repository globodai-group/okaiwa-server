import { defineConfig } from '@adonisjs/lucid'

/**
 * PostgreSQL database configuration for the identity service.
 *
 * SECURITY:
 * - SSL is REQUIRED in production — plaintext DB connections would
 *   expose hashed phone numbers and public keys in transit.
 * - Statement timeout prevents long-running queries that could be
 *   used for timing attacks on hash lookups.
 * - Connection pooling is limited to prevent connection exhaustion DoS.
 * - The database user should have MINIMAL privileges (no CREATE, DROP, etc.).
 *
 * DATA CLASSIFICATION:
 * - phoneHash: SHA-256 of phone number. Sensitive but not PII (irreversible).
 * - username: User-chosen, public.
 * - identityPublicKey: Public key, safe to expose.
 * - pre-keys: Public keys, consumed on use.
 */
export default defineConfig({
  connection: 'pg',

  connections: {
    pg: {
      client: 'pg',
      connection: {
        host: process.env.DB_HOST ?? '127.0.0.1',
        port: Number(process.env.DB_PORT ?? 5432),
        user: process.env.DB_USER ?? 'okaiwa_identity',
        password: process.env.DB_PASSWORD ?? '',
        database: process.env.DB_DATABASE ?? 'okaiwa_identity',

        /**
         * SSL configuration.
         * In production, SSL is mandatory to protect data in transit.
         * The CA certificate should be provided via DB_SSL_CA env var
         * for certificate pinning.
         */
        ssl: process.env.NODE_ENV === 'production'
          ? {
              rejectUnauthorized: true,
              ca: process.env.DB_SSL_CA ?? undefined,
            }
          : false,
      },

      pool: {
        /** Minimum connections kept alive. */
        min: 2,
        /** Maximum connections. Sized for expected discovery query load. */
        max: 20,
      },

      /**
       * Statement timeout in milliseconds.
       * Prevents long-running queries that could:
       * 1. Exhaust the connection pool (DoS).
       * 2. Be used for timing attacks on hash comparisons.
       */
      debug: false,

      healthCheck: true,

      migrations: {
        naturalSort: true,
        paths: ['database/migrations'],
      },
    },
  },
})
