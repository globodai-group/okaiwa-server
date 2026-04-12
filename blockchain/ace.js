/*
|--------------------------------------------------------------------------
| JavaScript entrypoint for running ace commands
|--------------------------------------------------------------------------
|
| Registers the TypeScript loader before importing the TypeScript
| CLI handler at `bin/console.ts`.
|
*/

import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

register('ts-node-maintained/register/esm', pathToFileURL('./'))

await import('./bin/console.js')
