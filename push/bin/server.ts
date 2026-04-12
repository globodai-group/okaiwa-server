/*
|--------------------------------------------------------------------------
| HTTP server entrypoint
|--------------------------------------------------------------------------
*/

import 'reflect-metadata'
import { Ignitor, prettyPrintError } from '@adonisjs/core'

const APP_ROOT = new URL('../', import.meta.url)

const app = new Ignitor(APP_ROOT)
  .tap((app) => {
    app.booting(async () => {
      await import('#start/routes')
    })
  })

try {
  await app.httpServer().start()
} catch (error) {
  process.exitCode = 1
  prettyPrintError(error)
}
