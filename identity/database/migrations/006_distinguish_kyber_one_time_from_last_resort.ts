import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Migration: distinguish one-time Kyber pre-keys from the long-lived
 * "last-resort" Kyber pre-key.
 *
 * libsignal publishes BOTH in its PreKeyBundle:
 *   - One-time Kyber pre-keys: consumed on fetch, provide post-quantum
 *     forward secrecy (PQ-FS) — once a session is built using one,
 *     the row is destroyed and a future compromise of the
 *     destination's identity key cannot retroactively decrypt that
 *     session's traffic.
 *   - Last-resort Kyber pre-key: long-lived, signed, used as a
 *     fallback when the one-time pool is exhausted. PQ-FS is
 *     degraded for sessions established this way (same model as
 *     the X3DH classic signed pre-key fallback).
 *
 * Migration 005 added `is_kyber_pre_key` but the controller treated
 * ALL kyber rows as never-consumed, which silently re-served the
 * same one-time material to every requester — breaking PQ-FS for
 * every session. The new boolean lets the controller pick the right
 * row + apply the right consumption policy.
 *
 * Default `false` for new uploads (one-time), explicitly `true` only
 * when the client uploads its single rotation-period last-resort key.
 */
export default class DistinguishKyberOneTimeFromLastResort extends BaseSchema {
  protected tableName = 'pre_keys'

  async up(): Promise<void> {
    this.schema.alterTable(this.tableName, (table) => {
      table.boolean('is_last_resort_kyber').notNullable().defaultTo(false)
    })
    // CONCURRENTLY = no ACCESS EXCLUSIVE on the table while the
    // index builds; writes to /v1/keys/prekeys keep flowing during
    // the migration. Knex doesn't expose this directly so we go raw.
    this.schema.raw(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pre_keys_account_kyber_lastresort
       ON pre_keys (account_id, is_kyber_pre_key, is_last_resort_kyber, consumed)`
    )
  }

  async down(): Promise<void> {
    this.schema.raw(`DROP INDEX CONCURRENTLY IF EXISTS idx_pre_keys_account_kyber_lastresort`)
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('is_last_resort_kyber')
    })
  }
}
