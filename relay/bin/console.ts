/*
|--------------------------------------------------------------------------
| Ace CLI entrypoint (TypeScript)
|--------------------------------------------------------------------------
|
| This file boots the AdonisJS Ace CLI. It is invoked from the `ace.js`
| bootstrap file at the project root, which registers the TypeScript
| loader before importing this module.
|
*/

import 'reflect-metadata'
import { Ignitor, prettyPrintError } from '@adonisjs/core'

const APP_ROOT = new URL('../', import.meta.url)

/**
 * Module importer — see bin/server.ts for rationale.
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
  })

try {
  await app.ace().handle(process.argv.splice(2))
} catch (error) {
  process.exitCode = 1
  prettyPrintError(error)
}
