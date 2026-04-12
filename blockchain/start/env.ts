import { Env } from '@adonisjs/core/env'

export default await Env.create(new URL('../', import.meta.url), {
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  PORT: Env.schema.number(),
  HOST: Env.schema.string({ format: 'host' }),
  LOG_LEVEL: Env.schema.string.optional(),
  APP_KEY: Env.schema.string(),
  TRUST_PROXY: Env.schema.boolean.optional(),

  /**
   * Blockchain RPC provider credentials (server-side only).
   * These are stripped from client-facing requests.
   */
  ALCHEMY_API_KEY: Env.schema.string.optional(),
  INFURA_PROJECT_ID: Env.schema.string.optional(),
})
