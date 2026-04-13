import { Env } from '@adonisjs/core/env'

export default await Env.create(new URL('../', import.meta.url), {
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  PORT: Env.schema.number(),
  HOST: Env.schema.string({ format: 'host' }),
  LOG_LEVEL: Env.schema.string.optional(),
  APP_KEY: Env.schema.string(),
  TRUST_PROXY: Env.schema.boolean.optional(),

  /**
   * PostgreSQL connection.
   */
  DB_CONNECTION: Env.schema.string(),
  PG_HOST: Env.schema.string({ format: 'host' }),
  PG_PORT: Env.schema.number(),
  PG_USER: Env.schema.string(),
  PG_PASSWORD: Env.schema.string(),
  PG_DB_NAME: Env.schema.string(),

  /**
   * Redis for rate-limiting and discovery caching.
   */
  REDIS_HOST: Env.schema.string({ format: 'host' }),
  REDIS_PORT: Env.schema.number(),
  REDIS_PASSWORD: Env.schema.string.optional(),
  REDIS_DB: Env.schema.number.optional(),

  /**
   * Dev-only SMS bypass. When set to a 6-digit string, the verify
   * endpoint accepts that code for ANY account instead of querying
   * the SMS gateway. MUST be left unset in production — the absence
   * of the env var disables the bypass.
   */
  DEV_SMS_BYPASS_CODE: Env.schema.string.optional(),
})
