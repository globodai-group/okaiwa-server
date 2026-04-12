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
  | Blockchain service: core + HTTP only.
  | Anonymized RPC proxy to Alchemy/Infura.
  | NEVER logs wallet addresses or transaction details.
  |
  */
  providers: [
    () => import('@adonisjs/core/providers/app_provider'),
    () => import('@adonisjs/core/providers/http_provider'),
  ],

  preloads: [
    () => import('#start/routes'),
  ],

  middleware: [
    () => import('#app/middleware/strip_metadata_middleware'),
  ],
})
