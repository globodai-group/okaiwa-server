/*
|--------------------------------------------------------------------------
| AdonisJS CLI entrypoint
|--------------------------------------------------------------------------
*/

import 'reflect-metadata'
import { Ignitor, prettyPrintError } from '@adonisjs/core'

const APP_ROOT = new URL('./', import.meta.url)

const app = new Ignitor(APP_ROOT)

try {
  await app.ace().handle(process.argv.splice(2))
} catch (error) {
  process.exitCode = 1
  prettyPrintError(error)
}
