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

const app = new Ignitor(APP_ROOT)

try {
  await app.ace().handle(process.argv.splice(2))
} catch (error) {
  process.exitCode = 1
  prettyPrintError(error)
}
