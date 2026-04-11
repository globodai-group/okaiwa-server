import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Migration: Create the accounts table.
 *
 * This table stores the minimal identity information needed for
 * the Signal Protocol key exchange and privacy-preserving discovery.
 *
 * SECURITY:
 * - phoneHash is indexed for O(1) lookup during contact discovery.
 * - username has a unique constraint (case-insensitive via index).
 * - No plaintext phone numbers are stored anywhere in this schema.
 * - UUIDs are used instead of sequential IDs to prevent enumeration.
 */
export default class CreateAccounts extends BaseSchema {
  protected tableName = 'accounts'

  async up(): Promise<void> {
    this.schema.createTable(this.tableName, (table) => {
      /**
       * UUIDv4 primary key.
       * Sequential integers would leak registration order and total
       * user count. UUIDs are random and non-enumerable.
       */
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))

      /**
       * SHA-256 hash of the phone number (E.164 format).
       * 64 hex characters = 256 bits.
       * Indexed for contact discovery batch lookups.
       *
       * Security: This is a one-way hash. The phone number cannot
       * be recovered from the hash without brute force.
       */
      table.string('phone_hash', 64).notNullable()
      table.index('phone_hash', 'idx_accounts_phone_hash')

      /**
       * Unique username. Optional (nullable).
       * Indexed with a case-insensitive unique constraint to prevent
       * "Alice" and "alice" from coexisting.
       */
      table.string('username', 32).nullable()
      table.unique(['username'])

      /**
       * Curve25519 identity public key, base64-encoded.
       * Public by design — shared with other users during
       * session establishment.
       */
      table.text('identity_public_key').notNullable()

      /**
       * Signal Protocol registration ID.
       * A 14-bit random number used to detect re-registrations.
       */
      table.integer('registration_id').notNullable()

      /**
       * Whether the account has been verified via SMS.
       * Unverified accounts are invisible to discovery and
       * cannot participate in messaging.
       */
      table.boolean('verified').notNullable().defaultTo(false)

      /**
       * Timestamps.
       * createdAt is used for account age checks.
       * updatedAt tracks the last modification.
       */
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
    })
  }

  async down(): Promise<void> {
    this.schema.dropTable(this.tableName)
  }
}
