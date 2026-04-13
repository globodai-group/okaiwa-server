import router from '@adonisjs/core/services/router'
import server from '@adonisjs/core/services/server'

/**
 * Server-level middleware runs on every HTTP request.
 */
server.use([
  () => import('@adonisjs/core/bodyparser_middleware'),
])

/**
 * Router-level middleware runs on matched routes.
 */
router.use([])

/**
 * Named middleware.
 */
export const middleware = router.named({})
