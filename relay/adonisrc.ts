import { defineConfig } from '@adonisjs/core/app'

export default defineConfig({
  /*
  |--------------------------------------------------------------------------
  | Commands
  |--------------------------------------------------------------------------
  */
  commands: [
    () => import('@adonisjs/core/commands'),
  ],

  /*
  |--------------------------------------------------------------------------
  | Service Providers
  |--------------------------------------------------------------------------
  |
  | Relay service: core + HTTP + Redis (for message queue with 7d TTL).
  | No database provider — relay NEVER stores messages persistently.
  |
  */
  providers: [
    () => import('@adonisjs/core/providers/app_provider'),
    () => import('@adonisjs/core/providers/http_provider'),
    () => import('@adonisjs/redis/redis_provider'),
  ],

  /*
  |--------------------------------------------------------------------------
  | Preloads
  |--------------------------------------------------------------------------
  */
  preloads: [
    () => import('#start/routes'),
  ],

  /*
  |--------------------------------------------------------------------------
  | Middleware
  |--------------------------------------------------------------------------
  */
  middleware: [
    () => import('#app/middleware/device_auth_middleware'),
    () => import('#app/middleware/rate_limit_middleware'),
  ],
})
