import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Migration: support Kyber pre-keys alongside the X3DH classic ones.
 *
 * libsignal-android 0.76+ and the equivalent iOS LibSignalClient
 * 0.92+ refuse to build a Signal session unless the PreKeyBundle
 * carries a Kyber-1024 (ML-KEM-1024) pre-key — PQXDH is mandatory.
 * The mobile clients started uploading them in commit
 * okaiwa-android@<chat-iter> ; this migration adds the matching
 * server-side storage so the field stops being silently dropped on
 * upload and missing on fetch.
 *
 * Rather than spinning up a brand-new `kyber_pre_keys` table that
 * mirrors the existing `pre_keys` schema, we reuse the same row
 * shape with an `is_kyber_pre_key` flag — Kyber keys are signed
 * (like signed pre-keys are) but live in their own pool, distinct
 * from the X3DH one-time pre-keys. The flag plus the existing
 * `is_signed_pre_key` flag give us four logical states:
 *
 *   is_signed=false, is_kyber=false → X3DH one-time pre-key (consumed on fetch)
 *   is_signed=true,  is_kyber=false → X3DH signed pre-key (long-lived)
 *   is_signed=false, is_kyber=true  → Kyber one-time pre-key (consumed on fetch)
 *   is_signed=true,  is_kyber=true  → reserved (not used yet)
 *
 * Index updated to include the new flag so the Postgres planner
 * doesn't fall back to a sequential scan when the controller queries
 * `WHERE is_kyber_pre_key = true AND consumed = false`.
 */
export default class AddKyberToPreKeys extends BaseSchema {
  protected tableName = 'pre_keys'

  async up(): Promise<void> {
    this.schema.alterTable(this.tableName, (table) => {
      table.boolean('is_kyber_pre_key').notNullable().defaultTo(false)
      table.index(
        ['account_id', 'is_kyber_pre_key', 'consumed'],
        'idx_pre_keys_account_kyber_consumed'
      )
    })
  }

  async down(): Promise<void> {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex(
        ['account_id', 'is_kyber_pre_key', 'consumed'],
        'idx_pre_keys_account_kyber_consumed'
      )
      table.dropColumn('is_kyber_pre_key')
    })
  }
}
