import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Migration: Create the profiles table.
 *
 * Stores user-controlled public profile information.
 * Everything in this table is VOLUNTARILY provided by the user.
 *
 * SECURITY:
 * - JSONB type for exposed_wallet_addresses enables efficient
 *   containment queries (@>) for wallet-based discovery.
 * - GIN index on exposed_wallet_addresses supports fast lookups
 *   without full table scans.
 * - Visibility column controls discoverability at the query level.
 */
export default class CreateProfiles extends BaseSchema {
  protected tableName = 'profiles'

  async up(): Promise<void> {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()

      /**
       * Foreign key to the owning account.
       * One-to-one relationship: each account has at most one profile.
       * CASCADE delete: profile is removed when account is deleted.
       */
      table.uuid('account_id').notNullable().unique()
        .references('id')
        .inTable('accounts')
        .onDelete('CASCADE')

      /**
       * Display name. Optional, user-chosen.
       * Can contain Unicode text (emoji, non-Latin scripts, etc.).
       */
      table.string('display_name', 64).nullable()

      /**
       * Short biography. Optional, user-written.
       */
      table.string('bio', 300).nullable()

      /**
       * Avatar URL. Points to client-managed encrypted storage.
       * The identity server does NOT host avatar images.
       */
      table.string('avatar_url', 512).nullable()

      /**
       * Wallet addresses explicitly exposed by the user.
       * Stored as JSONB array: ["0xabc...", "0xdef..."]
       *
       * Default: empty array (no wallets exposed).
       */
      table.jsonb('exposed_wallet_addresses').notNullable().defaultTo('[]')

      /**
       * Profile visibility level.
       * Controls discoverability in search and contact discovery.
       *
       * - "public": fully discoverable.
       * - "contacts": visible to mutual contacts only.
       * - "private": hidden from all discovery.
       *
       * Default: "public" — users can restrict after registration.
       */
      table.enum('visibility', ['public', 'contacts', 'private'], {
        useNative: true,
        enumName: 'profile_visibility',
        existingType: false,
      }).notNullable().defaultTo('public')

      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
    })

    /**
     * GIN index on exposed_wallet_addresses for efficient
     * containment queries during wallet-based discovery.
     *
     * This enables queries like:
     * SELECT * FROM profiles WHERE exposed_wallet_addresses @> '["0xabc..."]'
     * to execute without a full table scan.
     */
    this.schema.raw(`
      CREATE INDEX idx_profiles_wallet_addresses
      ON profiles USING GIN (exposed_wallet_addresses)
    `)
  }

  async down(): Promise<void> {
    this.schema.dropTable(this.tableName)

    /**
     * Drop the custom enum type created for visibility.
     */
    this.schema.raw('DROP TYPE IF EXISTS profile_visibility')
  }
}
