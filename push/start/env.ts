import { Env } from '@adonisjs/core/env'

export default await Env.create(new URL('../', import.meta.url), {
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  PORT: Env.schema.number(),
  HOST: Env.schema.string({ format: 'host' }),
  LOG_LEVEL: Env.schema.string.optional(),
  APP_KEY: Env.schema.string(),
  TRUST_PROXY: Env.schema.boolean.optional(),

  /**
   * FCM (Firebase Cloud Messaging) configuration.
   */
  FCM_PROJECT_ID: Env.schema.string(),
  FCM_SERVICE_ACCOUNT_JSON: Env.schema.string(),

  /**
   * APNs (Apple Push Notification service) configuration.
   */
  APNS_KEY_ID: Env.schema.string(),
  APNS_TEAM_ID: Env.schema.string(),
  APNS_KEY_PATH: Env.schema.string(),
  APNS_PRODUCTION: Env.schema.boolean.optional(),
})
