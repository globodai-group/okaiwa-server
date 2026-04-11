/**
 * ChainProviderService manages RPC endpoint selection for blockchain queries.
 *
 * SECURITY ARCHITECTURE:
 * - Multiple RPC providers are configured per chain (Alchemy, Infura, public RPCs).
 * - Requests are distributed via ROUND-ROBIN selection across providers.
 * - This prevents any single provider from seeing a complete picture
 *   of a user's blockchain activity.
 *
 * PRIVACY ENHANCEMENT VIA ROUND-ROBIN:
 * If all requests went to Alchemy, Alchemy could correlate:
 * - "At 10:00, someone queried balance of 0xABC"
 * - "At 10:01, someone sent a transaction from 0xABC"
 * - "At 10:02, someone queried balance of 0xABC again"
 *
 * With round-robin across Alchemy + Infura + public RPC:
 * - Alchemy sees: "At 10:00, someone queried balance of 0xABC"
 * - Infura sees: "At 10:01, someone sent a transaction from 0xABC"
 * - Public RPC sees: "At 10:02, someone queried balance of 0xABC"
 *
 * No single provider can reconstruct the full activity pattern.
 *
 * API KEY MANAGEMENT:
 * - API keys are stored in environment variables, not in code.
 * - Keys are injected into the RPC URL server-side — the client
 *   NEVER sees or handles the API key.
 * - This prevents key leakage from client-side code.
 */

/** Supported blockchain networks. */
export type SupportedChain =
  | 'ethereum'
  | 'polygon'
  | 'arbitrum'
  | 'optimism'
  | 'base'
  | 'avalanche'
  | 'bsc'

/**
 * Configuration for an RPC provider endpoint.
 */
interface ProviderEndpoint {
  /** Human-readable provider name (for logging, NOT for requests). */
  name: string
  /** Full URL including API key, ready to use for JSON-RPC requests. */
  url: string
}

/**
 * Round-robin counter per chain.
 * Tracks which provider to use next for each chain.
 */
const roundRobinCounters = new Map<SupportedChain, number>()

export class ChainProviderService {
  /**
   * Provider configurations per chain.
   * Loaded from environment variables at construction time.
   */
  private readonly providers: Map<SupportedChain, ProviderEndpoint[]>

  constructor() {
    this.providers = new Map()

    this.configureChain('ethereum', [
      {
        name: 'alchemy',
        url: `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY ?? ''}`,
      },
      {
        name: 'infura',
        url: `https://mainnet.infura.io/v3/${process.env.INFURA_API_KEY ?? ''}`,
      },
      {
        name: 'public',
        url: 'https://eth.llamarpc.com',
      },
    ])

    this.configureChain('polygon', [
      {
        name: 'alchemy',
        url: `https://polygon-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY ?? ''}`,
      },
      {
        name: 'infura',
        url: `https://polygon-mainnet.infura.io/v3/${process.env.INFURA_API_KEY ?? ''}`,
      },
      {
        name: 'public',
        url: 'https://polygon-rpc.com',
      },
    ])

    this.configureChain('arbitrum', [
      {
        name: 'alchemy',
        url: `https://arb-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY ?? ''}`,
      },
      {
        name: 'infura',
        url: `https://arbitrum-mainnet.infura.io/v3/${process.env.INFURA_API_KEY ?? ''}`,
      },
      {
        name: 'public',
        url: 'https://arb1.arbitrum.io/rpc',
      },
    ])

    this.configureChain('optimism', [
      {
        name: 'alchemy',
        url: `https://opt-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY ?? ''}`,
      },
      {
        name: 'infura',
        url: `https://optimism-mainnet.infura.io/v3/${process.env.INFURA_API_KEY ?? ''}`,
      },
      {
        name: 'public',
        url: 'https://mainnet.optimism.io',
      },
    ])

    this.configureChain('base', [
      {
        name: 'alchemy',
        url: `https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY ?? ''}`,
      },
      {
        name: 'public',
        url: 'https://mainnet.base.org',
      },
    ])

    this.configureChain('avalanche', [
      {
        name: 'infura',
        url: `https://avalanche-mainnet.infura.io/v3/${process.env.INFURA_API_KEY ?? ''}`,
      },
      {
        name: 'public',
        url: 'https://api.avax.network/ext/bc/C/rpc',
      },
    ])

    this.configureChain('bsc', [
      {
        name: 'public-1',
        url: 'https://bsc-dataseed1.binance.org',
      },
      {
        name: 'public-2',
        url: 'https://bsc-dataseed2.binance.org',
      },
      {
        name: 'public-3',
        url: 'https://bsc-dataseed3.binance.org',
      },
    ])
  }

  /**
   * Get the next RPC endpoint for a given chain using round-robin selection.
   *
   * Round-robin ensures that sequential requests are distributed across
   * different providers, preventing any single provider from observing
   * the full request pattern.
   *
   * @param chain - The target blockchain network
   * @returns The RPC endpoint URL with API key embedded
   * @throws Error if the chain is not supported
   */
  getEndpoint(chain: SupportedChain): string {
    const endpoints = this.providers.get(chain)

    if (!endpoints || endpoints.length === 0) {
      throw new Error(`No providers configured for chain: ${chain}`)
    }

    /**
     * Round-robin: cycle through available providers.
     * The counter wraps around using modulo.
     */
    const currentIndex = roundRobinCounters.get(chain) ?? 0
    const endpoint = endpoints[currentIndex % endpoints.length]!
    roundRobinCounters.set(chain, currentIndex + 1)

    /**
     * Security: We do NOT log which provider was selected.
     * If an attacker gains access to logs, they should not be
     * able to reconstruct the provider selection pattern.
     */
    return endpoint.url
  }

  /**
   * Get all configured provider names for a chain.
   * Used for health checks and monitoring — does NOT expose URLs or API keys.
   *
   * @param chain - The target blockchain network
   * @returns Array of provider names (e.g., ["alchemy", "infura", "public"])
   */
  getProviderNames(chain: SupportedChain): string[] {
    const endpoints = this.providers.get(chain)
    return endpoints?.map((e) => e.name) ?? []
  }

  /**
   * Configure providers for a specific chain.
   * Filters out providers with empty API keys.
   *
   * @param chain - The blockchain network
   * @param endpoints - Array of provider configurations
   */
  private configureChain(chain: SupportedChain, endpoints: ProviderEndpoint[]): void {
    /**
     * Filter out providers whose URLs contain empty API keys.
     * An endpoint like "https://eth-mainnet.g.alchemy.com/v2/" (no key)
     * would fail and waste a round-robin slot.
     */
    const validEndpoints = endpoints.filter((ep) => {
      /** Public RPCs (no API key needed) are always valid. */
      if (ep.name.startsWith('public')) return true
      /** Providers with API keys: check the key is present. */
      return !ep.url.endsWith('/')
    })

    this.providers.set(chain, validEndpoints)
  }
}
