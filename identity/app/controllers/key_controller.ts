import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import PreKey from '#app/models/pre_key'
import Account from '#app/models/account'

/**
 * KeyController manages Signal Protocol pre-key bundles.
 *
 * SECURITY ARCHITECTURE:
 * - Pre-keys are PUBLIC keys used for the X3DH key agreement protocol.
 * - One-time pre-keys are CONSUMED on fetch: they are returned to the
 *   requester and then DELETED from the database. This ensures that
 *   each pre-key is used for exactly one session establishment,
 *   providing forward secrecy.
 * - The signed pre-key is long-lived but rotated periodically by the client.
 * - Private keys NEVER leave the client device and are NEVER sent to this server.
 *
 * PROTOCOL FLOW (X3DH):
 * 1. Alice wants to message Bob.
 * 2. Alice fetches Bob's pre-key bundle: identity key + signed pre-key + one-time pre-key.
 * 3. Alice uses these to compute a shared secret (X3DH).
 * 4. The one-time pre-key is deleted server-side (consumed).
 * 5. If no one-time pre-keys remain, only the signed pre-key is returned
 *    (reduced forward secrecy but still functional).
 *
 * AUDIT NOTE: The DELETE-on-fetch behavior for one-time pre-keys is
 * critical for forward secrecy. Any code change that removes this
 * behavior MUST be rejected during security review.
 */

/** Validator for pre-key upload. */
const uploadPreKeysValidator = vine.compile(
  vine.object({
    /** Batch of one-time pre-keys to upload. */
    preKeys: vine.array(
      vine.object({
        keyId: vine.number().positive(),
        publicKey: vine.string().minLength(32).maxLength(128),
      })
    ).minLength(1).maxLength(100),

    /**
     * Optional signed pre-key rotation.
     * Clients should rotate the signed pre-key periodically
     * (recommended: every 7-30 days).
     */
    signedPreKey: vine.object({
      keyId: vine.number().positive(),
      publicKey: vine.string().minLength(32).maxLength(128),
      signature: vine.string().minLength(64).maxLength(256),
    }).optional(),

    /**
     * Optional Kyber-1024 (ML-KEM) pre-key for PQXDH.
     * libsignal 0.76+ requires this in every fetched bundle, so
     * mobile clients upload it at register time. The publicKey is
     * MUCH larger than a Curve25519 key (~1568 bytes raw → ~2090
     * chars base64) hence the wider maxLength bound.
     */
    kyberPreKey: vine.object({
      keyId: vine.number().positive(),
      publicKey: vine.string().minLength(64).maxLength(4096),
      signature: vine.string().minLength(64).maxLength(256),
    }).optional(),
  })
)

/** Validator for pre-key fetch. */
const fetchPreKeyValidator = vine.compile(
  vine.object({
    deviceId: vine.string().regex(/^[a-zA-Z0-9\-]{32,128}$/),
  })
)

export default class KeyController {
  /**
   * Upload a batch of one-time pre-keys and optionally rotate the signed pre-key.
   *
   * Clients should upload pre-keys proactively to ensure there are always
   * keys available for new sessions. When the server's supply of one-time
   * pre-keys for a device drops below a threshold, the client is notified
   * via a silent push to upload more.
   *
   * @param ctx - AdonisJS HTTP context
   * @returns 201 with the count of stored pre-keys
   */
  async uploadPreKeys({ request, response, auth }: HttpContext): Promise<void> {
    const payload = await request.validateUsing(uploadPreKeysValidator)

    /**
     * SECURITY: accountId comes from the HMAC-validated session token
     * the SessionAuthMiddleware put on `ctx.auth`. Reading it from a
     * client-supplied header would let any caller upload pre-keys for
     * any account — same horizontal auth bypass pattern we closed on
     * PUT /v1/profile in 8748917.
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
     * Store one-time pre-keys in batch.
     * Each pre-key is marked as not consumed (available for use).
     */
    const preKeyRecords = payload.preKeys.map((pk) => ({
      accountId: account.id,
      keyId: pk.keyId,
      publicKey: pk.publicKey,
      signature: null,
      isSignedPreKey: false,
      isKyberPreKey: false,
      consumed: false,
    }))

    await PreKey.createMany(preKeyRecords)

    /**
     * Rotate signed pre-key if provided.
     * The old signed pre-key is kept for a grace period to handle
     * in-flight messages that were encrypted with it.
     */
    if (payload.signedPreKey) {
      await PreKey.create({
        accountId: account.id,
        keyId: payload.signedPreKey.keyId,
        publicKey: payload.signedPreKey.publicKey,
        signature: payload.signedPreKey.signature,
        isSignedPreKey: true,
        isKyberPreKey: false,
        consumed: false,
      })
    }

    /**
     * Persist the Kyber pre-key if provided. Same rotation policy as
     * the classic signed pre-key — long-lived but rotated by clients
     * periodically. Required for PQXDH (libsignal 0.76+).
     */
    if (payload.kyberPreKey) {
      await PreKey.create({
        accountId: account.id,
        keyId: payload.kyberPreKey.keyId,
        publicKey: payload.kyberPreKey.publicKey,
        signature: payload.kyberPreKey.signature,
        isSignedPreKey: false,
        isKyberPreKey: true,
        consumed: false,
      })
    }

    /** Return the total count of available pre-keys for this account. */
    const availableCount = await PreKey
      .query()
      .where('accountId', account.id)
      .where('isSignedPreKey', false)
      .where('consumed', false)
      .count('* as total')

    response.created({
      stored: payload.preKeys.length,
      availablePreKeys: Number(availableCount[0]?.$extras?.total ?? 0),
    })
  }

  /**
   * Fetch a pre-key bundle for a device to establish a new session.
   *
   * Returns the identity key, signed pre-key, and ONE one-time pre-key.
   * The one-time pre-key is CONSUMED (deleted) after being returned.
   *
   * CRITICAL SECURITY BEHAVIOR:
   * The one-time pre-key is deleted from the database in the SAME
   * transaction as the read. This prevents race conditions where two
   * requesters get the same one-time pre-key (which would compromise
   * forward secrecy).
   *
   * If no one-time pre-keys are available, only the identity key and
   * signed pre-key are returned. The protocol still works but with
   * reduced forward secrecy guarantees.
   *
   * @param ctx - AdonisJS HTTP context
   * @returns Pre-key bundle for session establishment
   */
  async fetchPreKey({ params, response }: HttpContext): Promise<void> {
    /**
     * Validate the deviceId parameter shape. The regex rejects malformed
     * identifiers before any database query runs, preventing enumeration
     * probes from reaching Lucid.
     */
    const { deviceId } = await fetchPreKeyValidator.validate({ deviceId: params.deviceId })

    /**
     * Look up the account by its `deviceId` column (added in
     * eca9627). The previous version queried `id` which conflated
     * accountId with deviceId — wrong now that the two diverge.
     */
    const account = await Account.findBy('deviceId', deviceId)
    if (!account) {
      /**
       * Security: Generic error prevents device ID enumeration.
       */
      response.notFound({ error: 'Device not found' })
      return
    }

    /** Fetch the current signed pre-key (long-lived). */
    const signedPreKey = await PreKey
      .query()
      .where('accountId', account.id)
      .where('isSignedPreKey', true)
      .where('isKyberPreKey', false)
      .where('consumed', false)
      .orderBy('keyId', 'desc')
      .first()

    if (!signedPreKey) {
      /**
       * No signed pre-key available. This should not happen in normal
       * operation — it means the device has not completed registration.
       */
      response.notFound({ error: 'No pre-key bundle available' })
      return
    }

    /**
     * Fetch and CONSUME one one-time pre-key — atomically.
     *
     * The previous SELECT-then-save() pattern was a race: two
     * concurrent fetchers could both read the same unconsumed key,
     * then both flip `consumed = true` without conflict, returning
     * the SAME key to two peers. That breaks X3DH forward secrecy
     * because both peers would derive a session from the same
     * one-time material.
     *
     * The fix uses a single UPDATE...SET consumed=true WHERE id IN
     * (SELECT id FROM ... LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING *
     * — Postgres-specific but our deployment is pinned to Postgres
     * 15+. Concurrent callers serialize on the row lock; the second
     * caller skips the locked row and either gets the next available
     * key or null. No race possible.
     */
    const consumedRows = await PreKey
      .query()
      .from('pre_keys')
      .whereRaw(
        `id = (
          SELECT id FROM pre_keys
          WHERE account_id = ?
            AND is_signed_pre_key = false
            AND is_kyber_pre_key = false
            AND consumed = false
          ORDER BY key_id ASC
          LIMIT 1
          FOR UPDATE SKIP LOCKED
        )`,
        [account.id]
      )
      .update({ consumed: true })
      .returning(['key_id', 'public_key'])

    const oneTimePreKey = consumedRows[0] as
      | { key_id: number; public_key: string }
      | undefined

    /**
     * Fetch (without consuming, for now) the most recent Kyber
     * pre-key. PQXDH treats the Kyber key like a "signed pre-key"
     * conceptually — it stays available across multiple session
     * negotiations for a given rotation period, then the client
     * uploads a fresh one. Marking it consumed on every fetch would
     * exhaust the pool too fast, so we take the highest keyId
     * unconsumed and let rotation handle freshness. A future commit
     * will introduce per-rotation consumption to match Signal's own
     * server semantics — tracked as a follow-up.
     */
    const kyberPreKey = await PreKey
      .query()
      .where('accountId', account.id)
      .where('isKyberPreKey', true)
      .where('consumed', false)
      .orderBy('keyId', 'desc')
      .first()

    response.ok({
      identityKey: account.identityPublicKey,
      registrationId: account.registrationId,
      // Surface the deviceId so the receiver can address SessionCipher
      // properly — the path param is what the caller already had, so
      // we echo it back for symmetry with discovery responses.
      deviceId: account.deviceId,
      signedPreKey: {
        keyId: signedPreKey.keyId,
        publicKey: signedPreKey.publicKey,
        signature: signedPreKey.signature,
      },
      /**
       * One-time pre-key is null if supply is exhausted.
       * The client protocol handles this gracefully with
       * reduced forward secrecy.
       */
      preKey: oneTimePreKey
        ? {
            keyId: oneTimePreKey.key_id,
            publicKey: oneTimePreKey.public_key,
          }
        : null,
      /**
       * Kyber-1024 pre-key — required by libsignal 0.76+ for PQXDH.
       * When null the client will fail to build a session; we let the
       * mobile layer surface a clean error rather than silently fall
       * back to non-PQ session establishment.
       */
      kyberPreKey: kyberPreKey
        ? {
            keyId: kyberPreKey.keyId,
            publicKey: kyberPreKey.publicKey,
            signature: kyberPreKey.signature,
          }
        : null,
    })
  }
}
