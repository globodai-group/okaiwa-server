/*
|--------------------------------------------------------------------------
| HTTP server entrypoint
|--------------------------------------------------------------------------
|
| The "bin/server.ts" file is the entrypoint for starting the AdonisJS HTTP
| server. It boots the application and starts listening for incoming
| HTTP requests.
|
*/

import 'reflect-metadata'
import { Ignitor, prettyPrintError } from '@adonisjs/core'

const APP_ROOT = new URL('../', import.meta.url)

/**
 * Module importer used by Ignitor to resolve both relative paths
 * (e.g. `./app/controllers/foo`) and package identifiers
 * (e.g. `@adonisjs/assembler`). Without this, every call to
 * `app.import()` throws silently and the framework cannot locate
 * controllers, providers, or internal helpers.
 */
const IMPORTER = (filePath: string) => {
  if (filePath.startsWith('./') || filePath.startsWith('../')) {
    return import(new URL(filePath, APP_ROOT).href)
  }
  return import(filePath)
}

const app = new Ignitor(APP_ROOT, { importer: IMPORTER })
  .tap((app) => {
    app.booting(async () => {
      await import('#start/env')
    })
    app.listen('SIGTERM', () => app.terminate())
    app.listenIf(app.managedByPm2, 'SIGINT', () => app.terminate())
  })

try {
  await app.httpServer().start()
} catch (error) {
  process.exitCode = 1
  prettyPrintError(error)
}
