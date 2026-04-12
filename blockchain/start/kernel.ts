import router from '@adonisjs/core/services/router'
import server from '@adonisjs/core/services/server'

/**
 * StripMetadataMiddleware MUST run on every request before any controller
 * to ensure identifying headers are removed before proxying to RPC providers.
 */
server.use([
  () => import('#app/middleware/strip_metadata_middleware'),
])

router.use([])

export const middleware = router.named({})
