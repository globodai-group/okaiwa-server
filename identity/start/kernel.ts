import router from '@adonisjs/core/services/router'
import server from '@adonisjs/core/services/server'

/**
 * Server-level middleware runs on every HTTP request.
 */
server.use([])

/**
 * Router-level middleware runs on matched routes.
 */
router.use([])

/**
 * Named middleware.
 */
export const middleware = router.named({})
