import env from '#start/env'
import app from '@adonisjs/core/services/app'
import { defineConfig, targets } from '@adonisjs/core/logger'

/**
 * Logger configuration for the blockchain RPC proxy.
 *
 * SECURITY INVARIANT: Never log wallet addresses, transaction
 * hashes, or any client-identifying information. Only log
 * RPC method names, chain identifiers, and cache hit rates.
 */
const loggerConfig = defineConfig({
  default: 'app',

  loggers: {
    app: {
      enabled: true,
      name: '@okaiwa/blockchain',
      level: env.get('LOG_LEVEL', 'info'),
      transport: {
        targets: targets()
          .pushIf(!app.inProduction, targets.pretty())
          .pushIf(app.inProduction, targets.file({ destination: 1 }))
          .toArray(),
      },
    },
  },
})

export default loggerConfig
