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
  | Blockchain service: core + hash + vine only.
  | Anonymized RPC proxy to Alchemy/Infura.
  | NEVER logs wallet addresses or transaction details.
  |
  */
  providers: [
    () => import('@adonisjs/core/providers/app_provider'),
    () => import('@adonisjs/core/providers/hash_provider'),
    () => import('@adonisjs/core/providers/vinejs_provider'),
  ],

  preloads: [
    () => import('#start/routes'),
    () => import('#start/kernel'),
  ],

  metaFiles: [
    {
      pattern: 'public/**',
      reloadServer: false,
    },
  ],
})
