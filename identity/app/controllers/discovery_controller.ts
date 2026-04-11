import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import Account from '#app/models/account'
import Profile from '#app/models/profile'

/**
 * DiscoveryController implements privacy-preserving contact discovery.
 *
 * SECURITY ARCHITECTURE:
 * - Phone-based discovery uses hash comparison ONLY. The client hashes
 *   all contacts locally (SHA-256) and sends the hashes. The server
 *   compares against stored hashes. At NO point does the server see
 *   or reconstruct plaintext phone numbers.
 * - Username search is opt-in: users who set a username consent to
 *   being discoverable by it.
 * - Wallet address search is opt-in: users explicitly choose which
 *   wallet addresses to expose in their profile.
 * - Discovery responses include ONLY public information: username,
 *   identity public key, and registration ID. NEVER phone hashes.
 *
 * RATE LIMITING:
 * - Phone hash batch lookups are rate-limited to prevent mass scraping.
 *   Even though hashes are irreversible, an attacker with a phone
 *   directory could map hashes to numbers via brute force. Rate
 *   limiting makes this impractical at scale.
 * - Maximum batch size is 1000 hashes per request.
 *
 * FUTURE ENHANCEMENT: Consider implementing Private Set Intersection (PSI)
 * for even stronger privacy guarantees during contact discovery.
 */

/** Validator for batch phone hash lookup. */
const phoneHashesValidator = vine.compile(
  vine.object({
    /**
     * Array of SHA-256 phone number hashes.
     * Client computes these locally: SHA-256(normalize(phoneNumber)).
     * Maximum 1000 per request to prevent mass scraping.
     */
    hashes: vine.array(
      vine.string().regex(/^[a-f0-9]{64}$/)
    ).minLength(1).maxLength(1000),
  })
)

export default class DiscoveryController {
  /**
   * Discover registered contacts by phone number hashes.
   *
   * The client:
   * 1. Normalizes all phone numbers in the address book (E.164 format).
   * 2. Computes SHA-256 of each normalized number.
   * 3. Sends the hashes to this endpoint.
   *
   * The server:
   * 1. Compares each hash against the phoneHash column.
   * 2. Returns matches with ONLY public information.
   * 3. NEVER returns the phoneHash itself (to prevent confirmation attacks).
   *
   * @param ctx - AdonisJS HTTP context
   * @returns Array of matched contacts with public info only
   */
  async discoverByPhoneHashes({ request, response }: HttpContext): Promise<void> {
    const payload = await request.validateUsing(phoneHashesValidator)

    /**
     * Query accounts matching any of the provided hashes.
     * Only verified accounts are returned to prevent discovery
     * of accounts in registration limbo.
     */
    const matches = await Account
      .query()
      .whereIn('phoneHash', payload.hashes)
      .where('verified', true)
      .select('id', 'username', 'identityPublicKey', 'registrationId')

    /**
     * Build the response. We include the matched hash so the client
     * can correlate results with its contact list, but we do NOT
     * include any server-side information beyond the public profile.
     *
     * Security: The response reveals which of the submitted hashes
     * correspond to registered users. This is inherent to contact
     * discovery and is mitigated by rate limiting.
     */
    const results = matches.map((account) => ({
      /**
       * We intentionally do NOT return the phoneHash in the response.
       * The client already knows which hashes it sent — it can match
       * by comparing the returned identityPublicKey or username
       * with its local state. This prevents a MITM from learning
       * which specific hashes matched.
       */
      accountId: account.id,
      username: account.username,
      identityPublicKey: account.identityPublicKey,
      registrationId: account.registrationId,
    }))

    response.ok({
      matches: results,
      total: results.length,
    })
  }

  /**
   * Search for a user by username.
   *
   * Usernames are opt-in: only users who set a username are discoverable
   * via this endpoint. The search is exact-match only to prevent
   * enumeration via prefix/fuzzy search.
   *
   * @param ctx - AdonisJS HTTP context
   * @returns The user's public profile if found
   */
  async searchByUsername({ params, response }: HttpContext): Promise<void> {
    const username = params.username

    if (!username || typeof username !== 'string') {
      response.badRequest({ error: 'Username is required' })
      return
    }

    /**
     * Exact match only. Case-insensitive comparison using
     * database-level LOWER() for consistency.
     */
    const account = await Account
      .query()
      .whereRaw('LOWER(username) = LOWER(?)', [username])
      .where('verified', true)
      .first()

    if (!account) {
      response.notFound({ error: 'User not found' })
      return
    }

    const profile = await Profile.findBy('accountId', account.id)

    response.ok({
      accountId: account.id,
      username: account.username,
      identityPublicKey: account.identityPublicKey,
      registrationId: account.registrationId,
      profile: profile
        ? {
            displayName: profile.displayName,
            bio: profile.bio,
            avatarUrl: profile.avatarUrl,
          }
        : null,
    })
  }

  /**
   * Search for a user by wallet address.
   *
   * Only users who have explicitly exposed a wallet address in their
   * profile are discoverable via this endpoint. This is fully opt-in.
   *
   * @param ctx - AdonisJS HTTP context
   * @returns The user's public profile if found
   */
  async searchByWalletAddress({ params, response }: HttpContext): Promise<void> {
    const address = params.address

    if (!address || typeof address !== 'string') {
      response.badRequest({ error: 'Wallet address is required' })
      return
    }

    /**
     * Search the JSONB array of exposed wallet addresses.
     * Only profiles with visibility set to 'public' are searched.
     *
     * Security: The wallet address comparison is case-insensitive
     * for Ethereum addresses (which use mixed-case checksums).
     */
    const profile = await Profile
      .query()
      .whereRaw("exposed_wallet_addresses @> ?::jsonb", [JSON.stringify([address.toLowerCase()])])
      .where('visibility', 'public')
      .preload('account')
      .first()

    if (!profile || !profile.account) {
      response.notFound({ error: 'User not found' })
      return
    }

    response.ok({
      accountId: profile.account.id,
      username: profile.account.username,
      identityPublicKey: profile.account.identityPublicKey,
      registrationId: profile.account.registrationId,
      profile: {
        displayName: profile.displayName,
        bio: profile.bio,
        avatarUrl: profile.avatarUrl,
      },
    })
  }
}
