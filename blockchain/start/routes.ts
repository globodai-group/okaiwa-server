import router from '@adonisjs/core/services/router'

const RpcProxyController = () => import('#app/controllers/rpc_proxy_controller')
const BalanceController = () => import('#app/controllers/balance_controller')

/**
 * Blockchain RPC proxy routes.
 *
 * SECURITY ARCHITECTURE:
 * This service acts as an ANONYMOUS PROXY between Okaiwa clients
 * and blockchain RPC providers (Alchemy, Infura, public RPCs).
 *
 * WHY A PROXY:
 * If clients connected directly to Alchemy/Infura, the RPC provider
 * would see the client's IP address alongside their wallet address.
 * This creates a link between real-world identity (IP → ISP → person)
 * and on-chain identity (wallet address → transaction history).
 *
 * By proxying through this service:
 * 1. The RPC provider sees ONLY the Okaiwa server's IP, not the client's.
 * 2. The Okaiwa server strips all identifying headers before proxying.
 * 3. The Okaiwa server does NOT log wallet addresses or RPC requests.
 * 4. Round-robin provider selection prevents any single provider from
 *    seeing a user's full activity pattern.
 *
 * WHAT IS NOT LOGGED:
 * - Client IP addresses
 * - Wallet addresses
 * - Transaction data
 * - RPC method calls
 * - Request/response bodies
 */

router.group(() => {
  /**
   * POST /v1/rpc/:chain
   *
   * Proxy a JSON-RPC request to the appropriate chain's RPC provider.
   * All identifying metadata is stripped before forwarding.
   * The provider's API key is injected server-side.
   */
  router.post('/rpc/:chain', [RpcProxyController, 'proxy'])

  /**
   * GET /v1/balance/:chain/:address
   *
   * Get the native token balance for an address on a specific chain.
   * Results are cached briefly (30s) to reduce RPC provider load,
   * but the cache key does NOT include any client identity.
   */
  router.get('/balance/:chain/:address', [BalanceController, 'getBalance'])

  /**
   * GET /v1/transactions/:chain/:address
   *
   * Get recent transactions for an address on a specific chain.
   * Proxied anonymously through the RPC provider.
   */
  router.get('/transactions/:chain/:address', [RpcProxyController, 'getTransactions'])

  /**
   * POST /v1/broadcast/:chain
   *
   * Broadcast a signed transaction to the network.
   * The transaction is already signed by the client — the server
   * cannot modify it and does NOT know the signing key.
   */
  router.post('/broadcast/:chain', [RpcProxyController, 'broadcastTransaction'])

}).prefix('/v1')

/**
 * Health check.
 */
router.get('/health', async ({ response }) => {
  return response.ok({ status: 'ok', service: 'blockchain' })
})
