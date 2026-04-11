import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import vine from '@vinejs/vine'
import { ChainProviderService } from '#app/services/chain_provider_service'

/**
 * BalanceController retrieves native token balances for wallet addresses.
 *
 * SECURITY:
 * - Requests are proxied anonymously — the RPC provider cannot determine
 *   which Okaiwa user is querying the balance.
 * - Results are cached briefly (30 seconds) to reduce RPC provider load.
 * - The cache key is ONLY the chain + address (no client identity).
 * - Balance responses do NOT include any client-identifying metadata.
 *
 * WHY CACHE:
 * Brief caching (30s) serves two purposes:
 * 1. Reduces load on RPC providers (cost savings and rate limit compliance).
 * 2. IMPROVES privacy: multiple clients querying the same address within
 *    30s generate only ONE request to the provider, making it impossible
 *    to determine how many users are watching that address.
 *
 * The cache TTL is intentionally short (30s) so balances remain current
 * for a reasonable UX while still providing the above benefits.
 */

/** Balance cache: chain:address → { balance, cachedAt }. */
const balanceCache = new Map<string, { balance: string; cachedAt: number }>()

/** Cache TTL in milliseconds. */
const CACHE_TTL_MS = 30_000 // 30 seconds

/** Validator for chain parameter. */
const chainValidator = vine.compile(
  vine.object({
    chain: vine.enum([
      'ethereum',
      'polygon',
      'arbitrum',
      'optimism',
      'base',
      'avalanche',
      'bsc',
    ] as const),
  })
)

@inject()
export default class BalanceController {
  constructor(private readonly chainProvider: ChainProviderService) {}

  /**
   * Get the native token balance for an address on a specific chain.
   *
   * @param ctx - AdonisJS HTTP context
   * @returns The balance in the chain's native token (wei/smallest unit)
   */
  async getBalance({ params, response }: HttpContext): Promise<void> {
    const { chain } = await vine.validate({
      schema: chainValidator,
      data: { chain: params.chain },
    })

    const address = params.address

    /** Validate Ethereum-style address format. */
    if (!address || typeof address !== 'string' || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      response.badRequest({ error: 'Invalid address format' })
      return
    }

    /**
     * Check the in-memory cache.
     * Cache key: "chain:address" (lowercase for consistency).
     * NO client identity in the cache key — all clients share
     * the same cached result for the same address.
     */
    const cacheKey = `${chain}:${address.toLowerCase()}`
    const cached = balanceCache.get(cacheKey)

    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
      response.ok({
        chain,
        address: address.toLowerCase(),
        balance: cached.balance,
        cached: true,
      })
      return
    }

    const endpoint = this.chainProvider.getEndpoint(chain)

    try {
      /**
       * Query the balance via eth_getBalance JSON-RPC call.
       * The request is anonymous — the provider sees the Okaiwa
       * server's IP, not the client's.
       *
       * Security: We send ONLY the required parameters.
       * No extra headers, cookies, or identifying information.
       */
      const providerResponse = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_getBalance',
          params: [address, 'latest'],
          id: 1,
        }),
      })

      const result = (await providerResponse.json()) as {
        result?: string
        error?: { message: string }
      }

      if (result.error) {
        response.badGateway({
          error: 'Balance query failed',
          chain,
        })
        return
      }

      const balance = result.result ?? '0x0'

      /** Update cache. */
      balanceCache.set(cacheKey, {
        balance,
        cachedAt: Date.now(),
      })

      /**
       * Periodically clean up stale cache entries to prevent
       * unbounded memory growth.
       */
      if (balanceCache.size > 10_000) {
        this.pruneCache()
      }

      response.ok({
        chain,
        address: address.toLowerCase(),
        balance,
        cached: false,
      })
    } catch {
      /**
       * Security: Generic error — do NOT leak provider URL,
       * API key, or internal error details.
       */
      response.serviceUnavailable({
        error: 'Balance query unavailable',
        chain,
      })
    }
  }

  /**
   * Remove expired entries from the balance cache.
   * Called when cache size exceeds the threshold.
   */
  private pruneCache(): void {
    const now = Date.now()
    for (const [key, entry] of balanceCache.entries()) {
      if (now - entry.cachedAt > CACHE_TTL_MS) {
        balanceCache.delete(key)
      }
    }
  }
}
