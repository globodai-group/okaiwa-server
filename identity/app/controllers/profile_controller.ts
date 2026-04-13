import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import Account from '#app/models/account'
import Profile from '#app/models/profile'

/**
 * ProfileController manages user-controlled public profiles.
 *
 * SECURITY ARCHITECTURE:
 * - Profiles are entirely opt-in. Users choose what to expose.
 * - The "visibility" field controls discoverability:
 *   - "public": searchable by username and wallet address.
 *   - "contacts": visible only to mutual contacts.
 *   - "private": visible only to the user themselves.
 * - Exposed wallet addresses are explicitly selected by the user.
 *   The client has a multi-wallet architecture, and users choose
 *   which (if any) wallets to associate with their profile.
 * - Profile updates require authentication (session token).
 * - Profile reads for public profiles do not require authentication.
 */

/** Validator for profile update. */
const updateProfileValidator = vine.compile(
  vine.object({
    /** Display name shown in conversations and search results. */
    displayName: vine.string().minLength(1).maxLength(64).optional(),

    /** Short biography text. */
    bio: vine.string().maxLength(300).optional(),

    /** URL to the avatar image (hosted on client-side encrypted storage). */
    avatarUrl: vine.string().url().maxLength(512).optional(),

    /**
     * Wallet addresses the user chooses to expose publicly.
     * This is an explicit opt-in action by the user.
     * Addresses are stored lowercase for consistent lookups.
     */
    exposedWalletAddresses: vine.array(
      vine.string().regex(/^0x[a-fA-F0-9]{40}$/)
    ).maxLength(10).optional(),

    /**
     * Profile visibility level.
     * - "public": anyone can find this profile.
     * - "contacts": only mutual contacts can see details.
     * - "private": profile is hidden from discovery.
     */
    visibility: vine.enum(['public', 'contacts', 'private'] as const).optional(),

    /** Optional: update the unique username. */
    username: vine.string().minLength(3).maxLength(32).regex(/^[a-zA-Z0-9_]+$/).optional(),
  })
)

export default class ProfileController {
  /**
   * Update the authenticated user's profile.
   *
   * All fields are optional — only provided fields are updated.
   * This supports partial updates without requiring the client
   * to re-send unchanged fields.
   *
   * @param ctx - AdonisJS HTTP context
   * @returns 200 with the updated profile
   */
  async update({ request, response, auth }: HttpContext): Promise<void> {
    const payload = await request.validateUsing(updateProfileValidator)

    /**
     * SECURITY: accountId comes from the HMAC-validated session token
     * the SessionAuthMiddleware put on `ctx.auth`. We must NOT read
     * it from the request body or any header — that would re-open
     * the horizontal auth bypass the middleware was added to close
     * (any client could overwrite any other user's profile).
     */
    const accountId = auth?.accountId
    if (!accountId) {
      response.unauthorized({ error: 'Authentication required' })
      return
    }

    const account = await Account.find(accountId)
    if (!account) {
      response.notFound({ error: 'Account not found' })
      return
    }

    /**
     * Update username on the Account model if provided.
     * Username uniqueness is enforced by the database constraint.
     */
    if (payload.username !== undefined) {
      const existing = await Account
        .query()
        .whereRaw('LOWER(username) = LOWER(?)', [payload.username])
        .whereNot('id', account.id)
        .first()

      if (existing) {
        response.conflict({ error: 'Username is already taken' })
        return
      }

      account.username = payload.username
      await account.save()
    }

    /**
     * Upsert the profile record.
     * If no profile exists yet, create one with defaults.
     */
    let profile = await Profile.findBy('accountId', accountId)

    if (!profile) {
      profile = new Profile()
      profile.accountId = accountId
    }

    if (payload.displayName !== undefined) profile.displayName = payload.displayName
    if (payload.bio !== undefined) profile.bio = payload.bio
    if (payload.avatarUrl !== undefined) profile.avatarUrl = payload.avatarUrl
    if (payload.visibility !== undefined) profile.visibility = payload.visibility

    /**
     * Normalize wallet addresses to lowercase for consistent lookups.
     * The original mixed-case format is not preserved — clients
     * should use EIP-55 checksums locally if needed.
     */
    if (payload.exposedWalletAddresses !== undefined) {
      profile.exposedWalletAddresses = payload.exposedWalletAddresses.map(
        (addr) => addr.toLowerCase()
      )
    }

    await profile.save()

    response.ok({
      accountId: account.id,
      username: account.username,
      profile: {
        displayName: profile.displayName,
        bio: profile.bio,
        avatarUrl: profile.avatarUrl,
        exposedWalletAddresses: profile.exposedWalletAddresses,
        visibility: profile.visibility,
      },
    })
  }

  /**
   * Get the authenticated caller's own profile.
   *
   * Auth-required (gated by SessionAuthMiddleware): the accountId is
   * derived from the Bearer access token, so the caller can never
   * peek at someone else's full profile via this endpoint. Returns
   * even private/contacts-visibility fields that `get(:username)`
   * would hide — the caller IS the owner.
   *
   * The mobile Profile tab calls this on each cold start so the UI
   * reflects whatever was last saved on the server, regardless of
   * which device wrote the update.
   *
   * @param ctx - AdonisJS HTTP context
   * @returns 200 with the caller's profile, 404 if the account is gone
   */
  async me({ response, auth }: HttpContext): Promise<void> {
    const accountId = auth?.accountId
    if (!accountId) {
      response.unauthorized({ error: 'Authentication required' })
      return
    }

    const account = await Account.find(accountId)
    if (!account) {
      response.notFound({ error: 'Account not found' })
      return
    }

    const profile = await Profile.findBy('accountId', accountId)

    response.ok({
      accountId: account.id,
      username: account.username,
      identityPublicKey: account.identityPublicKey,
      profile: profile
        ? {
            displayName: profile.displayName,
            bio: profile.bio,
            avatarUrl: profile.avatarUrl,
            visibility: profile.visibility,
            // Owner sees their own exposed wallets even when the
            // visibility level would hide them from third parties.
            exposedWalletAddresses: profile.exposedWalletAddresses,
          }
        : null,
    })
  }

  /**
   * Get a user's public profile by username.
   *
   * Respects visibility settings:
   * - "public": full profile returned.
   * - "contacts": basic info only (full profile requires mutual contact).
   * - "private": returns 404 as if the user doesn't exist.
   *
   * @param ctx - AdonisJS HTTP context
   * @returns The user's public profile
   */
  async get({ params, response }: HttpContext): Promise<void> {
    const username = params.username

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

    /**
     * Security: Private profiles are invisible to discovery.
     * We return 404 (not 403) to prevent confirming the user exists.
     */
    if (profile?.visibility === 'private') {
      response.notFound({ error: 'User not found' })
      return
    }

    response.ok({
      accountId: account.id,
      username: account.username,
      identityPublicKey: account.identityPublicKey,
      profile: profile
        ? {
            displayName: profile.displayName,
            bio: profile.bio,
            avatarUrl: profile.avatarUrl,
            /**
             * Wallet addresses are only shown for public profiles.
             * For "contacts" visibility, they require mutual contact
             * verification (TODO: implement contact verification).
             */
            exposedWalletAddresses:
              profile.visibility === 'public'
                ? profile.exposedWalletAddresses
                : [],
          }
        : null,
    })
  }
}
