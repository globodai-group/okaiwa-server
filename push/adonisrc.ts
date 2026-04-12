import { defineConfig } from '@adonisjs/core/app'

export default defineConfig({
  commands: [
    () => import('@adonisjs/core/commands'),
  ],

  /*
  |--------------------------------------------------------------------------
  | Service Providers
  |--------------------------------------------------------------------------
  |
  | Push service: core + HTTP only.
  | Sends silent push notifications with ZERO content.
  | APNs: content-available:1 only. FCM: data-only, no notification payload.
  |
  */
  providers: [
    () => import('@adonisjs/core/providers/app_provider'),
    () => import('@adonisjs/core/providers/http_provider'),
  ],

  preloads: [
    () => import('#start/routes'),
  ],

  middleware: [],
})
