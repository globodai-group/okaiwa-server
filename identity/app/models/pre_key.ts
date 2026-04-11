import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Account from '#app/models/account'

/**
 * PreKey model stores Signal Protocol pre-keys for X3DH key exchange.
 *
 * SECURITY ARCHITECTURE:
 * - All pre-keys in this table are PUBLIC keys. Private keys NEVER
 *   leave the client device.
 * - One-time pre-keys (isSignedPreKey = false) are CONSUMED on fetch:
 *   when another user requests a pre-key to establish a session,
 *   the one-time pre-key is marked as consumed and will be deleted.
 *   This ensures each pre-key is used for exactly ONE session,
 *   providing forward secrecy.
 * - Signed pre-keys (isSignedPreKey = true) are long-lived but
 *   rotated periodically. They include a signature from the
 *   identity key for authenticity verification.
 * - When a user's one-time pre-key supply is exhausted, only the
 *   signed pre-key is returned. The protocol still works but with
 *   reduced forward secrecy (known as "fallback" mode in X3DH).
 *
 * CLEANUP POLICY:
 * - Consumed one-time pre-keys are periodically purged (cron job).
 * - Old signed pre-keys are kept for 30 days after rotation to
 *   handle in-flight messages encrypted with them.
 */
export default class PreKey extends BaseModel {
  public static table = 'pre_keys'

  /**
   * Primary key: auto-incrementing internal ID.
   * This is NOT the keyId from the Signal Protocol — that is
   * stored in the keyId column and is client-generated.
   */
  @column({ isPrimary: true })
  declare id: number

  /**
   * Foreign key to the owning account.
   */
  @column()
  declare accountId: string

  /**
   * Client-generated key identifier.
   * Used by the Signal Protocol to reference specific pre-keys
   * during session establishment.
   */
  @column()
  declare keyId: number

  /**
   * The public key material, base64-encoded.
   * This is a Curve25519 public key for one-time pre-keys,
   * or a signed Curve25519 public key for signed pre-keys.
   */
  @column()
  declare publicKey: string

  /**
   * Ed25519 signature of the public key, signed by the identity key.
   * Only present for signed pre-keys (isSignedPreKey = true).
   * Allows recipients to verify the pre-key was genuinely uploaded
   * by the account owner.
   */
  @column()
  declare signature: string | null

  /**
   * Distinguishes signed pre-keys from one-time pre-keys.
   * - true: Signed pre-key (long-lived, with signature).
   * - false: One-time pre-key (consumed after one use).
   */
  @column()
  declare isSignedPreKey: boolean

  /**
   * Whether this pre-key has been consumed (fetched by another user).
   *
   * SECURITY CRITICAL: Once consumed = true, this key MUST NOT be
   * returned to any subsequent requester. Reusing a one-time pre-key
   * would break forward secrecy — if the one-time pre-key's private
   * counterpart is later compromised, ALL sessions established with
   * it could be decrypted.
   */
  @column()
  declare consumed: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  /**
   * The account that owns this pre-key.
   */
  @belongsTo(() => Account)
  declare account: BelongsTo<typeof Account>
}
