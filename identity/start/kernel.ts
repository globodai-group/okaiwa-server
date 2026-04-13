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
 *
 * - `session`: validates the HMAC-signed Bearer access token issued
 *   by /v1/auth/verify. Attaches `ctx.auth.accountId` on success.
 *   Apply via `.use(middleware.session())` on routes that mutate
 *   user-owned data (profile, key uploads, account deletion).
 */
export const middleware = router.named({
  session: () => import('#app/middleware/session_auth_middleware'),
})
