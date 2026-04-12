import env from '#start/env'
import app from '@adonisjs/core/services/app'
import { defineConfig, targets } from '@adonisjs/core/logger'

/**
 * Logger configuration.
 *
 * SECURITY INVARIANT: The relay service processes encrypted message blobs.
 * This logger MUST NEVER be used to log request bodies, blob payloads,
 * sender identifiers, or recipient identifiers. Only timestamps, error
 * codes, and counter metrics are allowed.
 */
const loggerConfig = defineConfig({
  default: 'app',

  loggers: {
    app: {
      enabled: true,
      name: '@okaiwa/relay',
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
