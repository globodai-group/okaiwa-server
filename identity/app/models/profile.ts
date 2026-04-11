import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Account from '#app/models/account'

/**
 * Profile model stores user-controlled public profile information.
 *
 * PRIVACY ARCHITECTURE:
 * - Everything in this model is VOLUNTARILY provided by the user.
 * - Users control their visibility level:
 *   - "public": discoverable by anyone.
 *   - "contacts": visible only to mutual contacts.
 *   - "private": invisible to discovery (profile exists but is hidden).
 * - Exposed wallet addresses are an EXPLICIT opt-in. The client
 *   manages multiple wallets, and users choose which (if any) to
 *   associate with their Okaiwa profile.
 * - The displayName is separate from the username. Users can have
 *   a display name without a username, and vice versa.
 * - Avatar URLs point to client-managed encrypted storage. The
 *   identity server does NOT host avatar images directly.
 */
export default class Profile extends BaseModel {
  public static table = 'profiles'

  @column({ isPrimary: true })
  declare id: number

  /**
   * Foreign key to the owning account.
   * One account has at most one profile (1:1 relationship).
   */
  @column()
  declare accountId: string

  /**
   * Display name shown in conversations and search results.
   * This is user-chosen and can contain any Unicode text.
   */
  @column()
  declare displayName: string | null

  /**
   * Short biography text. User-written, publicly visible
   * based on visibility settings.
   */
  @column()
  declare bio: string | null

  /**
   * URL to the avatar image.
   * Points to client-managed encrypted storage (e.g., CDN with
   * signed URLs). The identity server does not host avatars.
   */
  @column()
  declare avatarUrl: string | null

  /**
   * Wallet addresses the user has explicitly chosen to expose.
   *
   * Stored as a JSONB array of lowercase hex addresses.
   * Example: ["0xabc123...", "0xdef456..."]
   *
   * Security: These addresses are VOLUNTARILY exposed by the user.
   * The wallet service in the client manages many more addresses
   * that are NOT listed here. Only listed addresses are discoverable.
   */
  @column({
    prepare: (value: string[]) => JSON.stringify(value),
    consume: (value: string) => {
      if (typeof value === 'string') return JSON.parse(value) as string[]
      if (Array.isArray(value)) return value as string[]
      return []
    },
  })
  declare exposedWalletAddresses: string[]

  /**
   * Profile visibility level.
   *
   * - "public": Profile is discoverable by anyone via search.
   * - "contacts": Profile details visible only to mutual contacts.
   *   Discovery returns basic info (username + identity key only).
   * - "private": Profile is hidden from all discovery mechanisms.
   *   The user appears as if they don't exist to searchers.
   */
  @column()
  declare visibility: 'public' | 'contacts' | 'private'

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  /**
   * The account that owns this profile.
   */
  @belongsTo(() => Account)
  declare account: BelongsTo<typeof Account>
}
