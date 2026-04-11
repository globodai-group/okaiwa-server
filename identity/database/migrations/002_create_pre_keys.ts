import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Migration: Create the pre_keys table.
 *
 * Stores Signal Protocol pre-keys for the X3DH key agreement protocol.
 * All keys in this table are PUBLIC keys — private keys never leave
 * the client device.
 *
 * SECURITY:
 * - Composite index on (account_id, is_signed_pre_key, consumed) enables
 *   efficient lookup of available pre-keys without full table scans.
 * - The "consumed" column tracks one-time pre-key usage. Once consumed,
 *   a pre-key MUST NOT be returned to any subsequent requester.
 */
export default class CreatePreKeys extends BaseSchema {
  protected tableName = 'pre_keys'

  async up(): Promise<void> {
    this.schema.createTable(this.tableName, (table) => {
      /**
       * Auto-incrementing internal ID.
       * This is NOT the client-generated keyId — that is a separate column.
       */
      table.increments('id').primary()

      /**
       * Foreign key to the owning account.
       * CASCADE delete: when an account is deleted, all its pre-keys
       * are automatically removed.
       */
      table.uuid('account_id').notNullable()
        .references('id')
        .inTable('accounts')
        .onDelete('CASCADE')

      /**
       * Client-generated key identifier.
       * Used by the Signal Protocol to reference specific pre-keys.
       * Unique per account (not globally unique).
       */
      table.integer('key_id').notNullable()

      /**
       * Public key material, base64-encoded.
       * Curve25519 public key for key agreement.
       */
      table.text('public_key').notNullable()

      /**
       * Ed25519 signature of the public key.
       * NULL for one-time pre-keys.
       * Present for signed pre-keys (verified by the recipient
       * using the identity public key).
       */
      table.text('signature').nullable()

      /**
       * Distinguishes signed pre-keys from one-time pre-keys.
       */
      table.boolean('is_signed_pre_key').notNullable().defaultTo(false)

      /**
       * Whether this pre-key has been consumed (fetched by a requester).
       *
       * CRITICAL: Once true, this key MUST NOT be reused.
       * The query for available pre-keys filters on consumed = false.
       */
      table.boolean('consumed').notNullable().defaultTo(false)

      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      /**
       * Composite index for efficient pre-key lookup.
       * The most common query is: "find an unconsumed one-time pre-key
       * for account X" — this index makes it O(1).
       */
      table.index(
        ['account_id', 'is_signed_pre_key', 'consumed'],
        'idx_pre_keys_available'
      )

      /**
       * Unique constraint: each keyId is unique per account.
       * Prevents duplicate key uploads from buggy clients.
       */
      table.unique(['account_id', 'key_id'])
    })
  }

  async down(): Promise<void> {
    this.schema.dropTable(this.tableName)
  }
}
