import router from '@adonisjs/core/services/router'

const AuthController = () => import('#app/controllers/auth_controller')
const KeyController = () => import('#app/controllers/key_controller')
const DiscoveryController = () => import('#app/controllers/discovery_controller')
const ProfileController = () => import('#app/controllers/profile_controller')

/**
 * Identity service routes.
 *
 * SECURITY INVARIANT:
 * - No route accepts or returns plaintext phone numbers.
 * - Discovery routes accept ONLY pre-hashed values.
 * - Pre-key fetch routes DELETE the key after returning it (one-time use).
 * - All authenticated routes require a valid session token.
 */

router.group(() => {
  /**
   * === Authentication ===
   *
   * Registration uses phone hash + identity key.
   * Verification uses a one-time SMS code (the SMS is sent by a
   * separate, isolated SMS gateway that does NOT have access to
   * the identity database).
   */
  router.post('/auth/register', [AuthController, 'register'])
  router.post('/auth/verify', [AuthController, 'verify'])
  router.post('/auth/refresh', [AuthController, 'refresh'])
  /**
   * Login is symmetric to register but only succeeds for accounts
   * that already exist — the mobile UI uses the 404 to push the user
   * into the create-account flow instead of silently registering.
   */
  router.post('/auth/login', [AuthController, 'login'])

  /**
   * === Key Management (Signal Protocol) ===
   *
   * Pre-key bundles are essential for the Double Ratchet protocol.
   * - Upload: Client uploads a batch of one-time pre-keys.
   * - Fetch: Requesting a pre-key for a device CONSUMES it (one-time use).
   *   This prevents replay attacks and ensures forward secrecy.
   */
  router.post('/keys/prekeys', [KeyController, 'uploadPreKeys'])
  router.post('/keys/prekey/:deviceId', [KeyController, 'fetchPreKey'])

  /**
   * === Discovery ===
   *
   * Privacy-preserving contact discovery:
   * - Phone hash batch lookup: Client hashes ALL contacts locally,
   *   sends the hashes. Server compares against stored hashes.
   *   NEVER sees plaintext numbers.
   * - Username search: Public, opt-in discovery.
   * - Wallet address search: Find users who expose their wallet.
   */
  router.post('/discovery/phone-hashes', [DiscoveryController, 'discoverByPhoneHashes'])
  router.get('/discovery/username/:username', [DiscoveryController, 'searchByUsername'])
  router.get('/discovery/wallet/:address', [DiscoveryController, 'searchByWalletAddress'])

  /**
   * === Profile ===
   *
   * User-controlled public profile. Users choose what to expose.
   * Wallet addresses are opt-in (exposedWalletAddresses).
   */
  router.put('/profile', [ProfileController, 'update'])
  router.get('/profile/:username', [ProfileController, 'get'])

}).prefix('/v1')

/**
 * Health check — returns 200 if service and database are reachable.
 */
router.get('/health', async ({ response }) => {
  return response.ok({ status: 'ok', service: 'identity' })
})
