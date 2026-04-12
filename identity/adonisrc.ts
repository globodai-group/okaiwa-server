import { defineConfig } from '@adonisjs/core/app'

export default defineConfig({
  commands: [
    () => import('@adonisjs/core/commands'),
    () => import('@adonisjs/lucid/commands'),
  ],

  /*
  |--------------------------------------------------------------------------
  | Service Providers
  |--------------------------------------------------------------------------
  |
  | Identity service: core + HTTP + Lucid (PostgreSQL) + Redis.
  | Stores ONLY: phone hashes, usernames, public keys, pre-keys.
  | NEVER stores: plaintext phone numbers, messages, private keys.
  |
  */
  providers: [
    () => import('@adonisjs/core/providers/app_provider'),
    () => import('@adonisjs/core/providers/http_provider'),
    () => import('@adonisjs/lucid/database_provider'),
    () => import('@adonisjs/redis/redis_provider'),
  ],

  preloads: [
    () => import('#start/routes'),
  ],

  middleware: [],
})
