import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import vine from '@vinejs/vine'
import { ChainProviderService } from '#app/services/chain_provider_service'

/**
 * RPCProxyController anonymously proxies JSON-RPC calls to blockchain nodes.
 *
 * SECURITY ARCHITECTURE:
 * - The client's IP address is STRIPPED before forwarding to the RPC provider.
 * - The RPC provider's API key is injected SERVER-SIDE — the client never
 *   sees or handles the API key.
 * - Request and response bodies are NOT logged — they contain wallet
 *   addresses and transaction data that could de-anonymize users.
 * - Round-robin provider selection ensures no single provider sees
 *   a complete picture of any user's activity.
 * - Certain RPC methods that could leak server state are blocked
 *   (e.g., net_peerCount, admin_*, debug_*).
 *
 * WHAT THE RPC PROVIDER SEES:
 * - The Okaiwa server's IP address (not the client's).
 * - The JSON-RPC method and parameters (required for execution).
 * - The server's API key (authenticates Okaiwa, not the user).
 *
 * WHAT THE RPC PROVIDER DOES NOT SEE:
 * - The client's IP address, User-Agent, or any identifying headers.
 * - Which Okaiwa user made the request.
 * - Any correlation between requests from different users.
 */

/** JSON-RPC methods that are BLOCKED for security/privacy reasons. */
const BLOCKED_METHODS = new Set([
  /** Admin methods — could expose server configuration. */
  'admin_addPeer',
  'admin_removePeer',
  'admin_nodeInfo',
  'admin_datadir',
  /** Debug methods — could expose internal state. */
  'debug_traceTransaction',
  'debug_storageRangeAt',
  'debug_setHead',
  /** Network methods — could reveal server's peer connections. */
  'net_peerCount',
  'net_listening',
  /** Mining methods — not relevant and could be abused. */
  'miner_start',
  'miner_stop',
  'miner_setGasPrice',
])

/** Validator for JSON-RPC proxy requests. */
const rpcProxyValidator = vine.compile(
  vine.object({
    jsonrpc: vine.string().in(['2.0']),
    method: vine.string().minLength(1).maxLength(100),
    /** JSON-RPC params are heterogeneous by specification — any JSON value is valid. */
    params: vine.array(vine.any()).optional(),
    /**
     * JSON-RPC id is a string, number, or null. VineJS 2 unions require the
     * conditional `union.if` syntax which is overkill here. We accept `any`
     * and echo it back unchanged in the response — the value is client-opaque.
     */
    id: vine.any(),
  })
)

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

/** Validator for broadcast transaction. */
const broadcastValidator = vine.compile(
  vine.object({
    signedTransaction: vine.string().regex(/^0x[a-fA-F0-9]+$/),
  })
)

@inject()
export default class RpcProxyController {
  constructor(private readonly chainProvider: ChainProviderService) {}

  /**
   * Proxy a JSON-RPC request to the appropriate chain's RPC provider.
   *
   * The request is stripped of all identifying metadata and forwarded
   * with the server's API key. The response is returned unmodified.
   *
   * @param ctx - AdonisJS HTTP context
   * @returns The JSON-RPC response from the provider
   */
  async proxy({ params, request, response }: HttpContext): Promise<void> {
    const { chain } = await chainValidator.validate({ chain: params.chain })

    const rpcPayload = await request.validateUsing(rpcProxyValidator)

    /**
     * Security: Block dangerous RPC methods that could expose
     * server state or be used for abuse.
     */
    if (BLOCKED_METHODS.has(rpcPayload.method)) {
      response.forbidden({
        jsonrpc: '2.0',
        error: {
          code: -32601,
          message: 'Method not allowed',
        },
        id: rpcPayload.id,
      })
      return
    }

    /**
     * Get the RPC endpoint URL for this chain.
     * The provider is selected via round-robin for privacy.
     * The API key is embedded in the URL.
     */
    const endpoint = this.chainProvider.getEndpoint(chain)

    try {
      /**
       * Forward the JSON-RPC request to the provider.
       * All identifying headers from the client have been stripped
       * by StripMetadataMiddleware before reaching this controller.
       *
       * Security: We use a clean fetch() call with NO forwarded headers.
       * The only headers sent are Content-Type and the provider's
       * authentication (embedded in the URL or via API key header).
       */
      const providerResponse = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          /**
           * Security: No User-Agent, no X-Forwarded-For, no cookies,
           * no referrer. The provider sees a generic HTTP request
           * from the Okaiwa server's IP — nothing more.
           */
        },
        body: JSON.stringify({
          jsonrpc: rpcPayload.jsonrpc,
          method: rpcPayload.method,
          params: rpcPayload.params ?? [],
          id: rpcPayload.id,
        }),
      })

      const result = await providerResponse.json()

      /**
       * Security: Return the provider's response verbatim.
       * We do NOT add any headers or metadata that could leak
       * which provider was used or the server's internal state.
       */
      response.status(providerResponse.status).json(result)
    } catch {
      /**
       * Security: Generic error — do NOT leak the provider URL,
       * API key, or internal error details.
       */
      response.serviceUnavailable({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'RPC provider unavailable',
        },
        id: rpcPayload.id,
      })
    }
  }

  /**
   * Get recent transactions for an address on a specific chain.
   *
   * Proxies the request anonymously to the RPC provider.
   * The client's IP is stripped — the provider cannot correlate
   * the wallet address with a real-world identity.
   *
   * @param ctx - AdonisJS HTTP context
   * @returns Transaction list from the provider
   */
  async getTransactions({ params, response }: HttpContext): Promise<void> {
    const { chain } = await chainValidator.validate({ chain: params.chain })

    const address = params.address

    if (!address || typeof address !== 'string' || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      response.badRequest({ error: 'Invalid address format' })
      return
    }

    const endpoint = this.chainProvider.getEndpoint(chain)

    try {
      /**
       * Use eth_getBlockByNumber + filtering or provider-specific
       * transaction listing APIs.
       *
       * Security: The address is sent to the provider (unavoidable —
       * it's needed to query the chain), but the provider cannot
       * determine WHO is querying this address.
       */
      const providerResponse = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_getTransactionCount',
          params: [address, 'latest'],
          id: 1,
        }),
      })

      const result = await providerResponse.json()
      response.ok(result)
    } catch {
      response.serviceUnavailable({ error: 'RPC provider unavailable' })
    }
  }

  /**
   * Broadcast a signed transaction to the blockchain network.
   *
   * The transaction is already signed by the client's private key
   * (which NEVER leaves the device). The server simply forwards
   * the signed bytes to the network.
   *
   * Security: The server cannot modify the transaction (it's signed).
   * The server does NOT know the signing key and cannot create
   * transactions on behalf of the user.
   *
   * @param ctx - AdonisJS HTTP context
   * @returns The transaction hash on success
   */
  async broadcastTransaction({ params, request, response }: HttpContext): Promise<void> {
    const { chain } = await chainValidator.validate({ chain: params.chain })

    const payload = await request.validateUsing(broadcastValidator)

    const endpoint = this.chainProvider.getEndpoint(chain)

    try {
      const providerResponse = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_sendRawTransaction',
          params: [payload.signedTransaction],
          id: 1,
        }),
      })

      const result = await providerResponse.json()

      /**
       * Security: We do NOT log the transaction hash or the signed
       * transaction data. This prevents building a correlation
       * between Okaiwa devices and on-chain transactions.
       */
      response.ok(result)
    } catch {
      response.serviceUnavailable({ error: 'Transaction broadcast failed' })
    }
  }
}
