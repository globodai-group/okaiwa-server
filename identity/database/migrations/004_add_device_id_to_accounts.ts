import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Migration: Add device_id to accounts.
 *
 * The relay service authenticates devices via opaque HMAC tokens of
 * the form {deviceId}.{timestamp}.{hmac}. The relay never resolves
 * the deviceId back to an account — that's by design (zero-knowledge
 * separation). The identity service issues those tokens at verify
 * time using a shared HMAC secret (`DEVICE_AUTH_SECRET`).
 *
 * Storing the deviceId on the account row gives us a stable
 * identifier across device re-registrations on the same account, and
 * lets discovery responses surface a recipient deviceId so a sender
 * can address them via the relay.
 *
 * SECURITY:
 * - The deviceId is a UUIDv4, no semantic meaning.
 * - It is rotated whenever the account re-registers a new physical
 *   device (different identity key) — handled in a follow-up migration
 *   that will introduce a separate `devices` table for multi-device.
 *   For now, one account = one device.
 */
export default class AddDeviceIdToAccounts extends BaseSchema {
  protected tableName = 'accounts'

  async up(): Promise<void> {
    this.schema.alterTable(this.tableName, (table) => {
      table.uuid('device_id').nullable().defaultTo(this.raw('gen_random_uuid()'))
      table.index('device_id', 'idx_accounts_device_id')
    })
  }

  async down(): Promise<void> {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex('device_id', 'idx_accounts_device_id')
      table.dropColumn('device_id')
    })
  }
}
