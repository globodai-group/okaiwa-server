import router from '@adonisjs/core/services/router'
import server from '@adonisjs/core/services/server'

/**
 * Server-level middleware runs on every HTTP request, including requests
 * that don't match any registered route.
 */
server.use([])

/**
 * Router-level middleware runs only on requests that match a registered route.
 */
router.use([
  () => import('#app/middleware/device_auth_middleware'),
  () => import('#app/middleware/rate_limit_middleware'),
])

/**
 * Named middleware are only applied when explicitly referenced on a route.
 */
export const middleware = router.named({})
