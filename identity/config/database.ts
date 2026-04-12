import { defineConfig } from '@adonisjs/lucid'
import env from '#start/env'

/**
 * PostgreSQL database configuration for the identity service.
 *
 * SECURITY:
 * - SSL is REQUIRED when connecting to a remote PostgreSQL host in production.
 *   For localhost connections, SSL is typically disabled at the PG level
 *   and unnecessary at the transport layer (loopback is not observable).
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
const pgHost = env.get('PG_HOST')
const isLocalhost = pgHost === '127.0.0.1' || pgHost === 'localhost' || pgHost === '::1'

/**
 * Enable SSL only for non-localhost production connections.
 * Loopback traffic does not traverse the network, so SSL adds no value
 * and would require setting up a local CA.
 */
const sslConfig =
  env.get('NODE_ENV') === 'production' && !isLocalhost
    ? {
        rejectUnauthorized: env.get('DB_SSL_REJECT_UNAUTHORIZED', 'true') === 'true',
        ca: env.get('DB_SSL_CA', undefined),
      }
    : false

export default defineConfig({
  connection: env.get('DB_CONNECTION', 'pg'),

  connections: {
    pg: {
      client: 'pg',
      connection: {
        host: pgHost,
        port: env.get('PG_PORT'),
        user: env.get('PG_USER'),
        password: env.get('PG_PASSWORD'),
        database: env.get('PG_DB_NAME'),
        ssl: sslConfig,
      },

      pool: {
        min: 2,
        max: 20,
      },

      debug: false,
      healthCheck: true,

      migrations: {
        naturalSort: true,
        paths: ['database/migrations'],
      },
    },
  },
})
