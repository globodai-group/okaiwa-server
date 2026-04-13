import { DateTime } from 'luxon'
import { BaseModel, column, hasMany, hasOne } from '@adonisjs/lucid/orm'
import type { HasMany, HasOne } from '@adonisjs/lucid/types/relations'
import PreKey from '#app/models/pre_key'
import Profile from '#app/models/profile'

/**
 * Account model represents a registered user in the Okaiwa system.
 *
 * DATA CLASSIFICATION:
 * - id: Internal identifier. UUIDv4, no semantic meaning.
 * - phoneHash: SHA-256 hash of the user's phone number (E.164 format).
 *   This is a ONE-WAY hash — the server CANNOT recover the phone number.
 *   Indexed for contact discovery lookups.
 * - username: User-chosen, publicly visible if set. Unique.
 * - identityPublicKey: Curve25519 public key for the Signal Protocol.
 *   Public by design — needed by other users to establish encrypted sessions.
 * - registrationId: Signal Protocol registration ID. Public.
 * - verified: Whether the account has completed SMS verification.
 *
 * WHAT IS NOT STORED:
 * - Plaintext phone numbers (NEVER received by this service).
 * - Private keys (NEVER leave the client device).
 * - IP addresses (NOT logged or stored).
 * - Device fingerprints (NOT collected).
 */
export default class Account extends BaseModel {
  public static table = 'accounts'

  /**
   * Primary key: UUIDv4.
   * No auto-incrementing integer — sequential IDs leak registration order.
   */
  @column({ isPrimary: true })
  declare id: string

  /**
   * SHA-256 hash of the phone number in E.164 format.
   * Indexed for contact discovery queries.
   *
   * Security: This is irreversible. Even with database access,
   * an attacker cannot recover phone numbers without a precomputed
   * rainbow table of all possible phone numbers. Salting is not used
   * because the hash must be deterministic for discovery (the client
   * computes the same hash to search for contacts).
   */
  @column()
  declare phoneHash: string

  /**
   * User-chosen username. Optional but unique if set.
   * Enables discovery by username for users who opt in.
   */
  @column()
  declare username: string | null

  /**
   * Curve25519 identity public key, base64-encoded.
   * This is the long-term public key used in the Signal Protocol's
   * X3DH key agreement. It is public by design.
   */
  @column()
  declare identityPublicKey: string

  /**
   * Signal Protocol registration ID.
   * A random 14-bit number used to detect re-registrations.
   */
  @column()
  declare registrationId: number

  /**
   * Whether the account has been verified via SMS.
   * Unverified accounts cannot be discovered or send messages.
   */
  @column()
  declare verified: boolean

  /**
   * UUIDv4 device identifier — addressable by the relay service.
   * The identity service issues a relay deviceToken at verify time of
   * the form `{deviceId}.{timestamp}.{hmac}`; the relay never sees
   * the accountId and cannot map it back to identity data.
   */
  @column()
  declare deviceId: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  /**
   * Pre-keys associated with this account.
   * Includes both one-time pre-keys and signed pre-keys.
   */
  @hasMany(() => PreKey)
  declare preKeys: HasMany<typeof PreKey>

  /**
   * Public profile associated with this account.
   * Profiles are opt-in and user-controlled.
   */
  @hasOne(() => Profile)
  declare profile: HasOne<typeof Profile>
}
