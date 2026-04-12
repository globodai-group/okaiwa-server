/*
|--------------------------------------------------------------------------
| JavaScript entrypoint for running ace commands
|--------------------------------------------------------------------------
|
| Since we cannot run TypeScript source code directly using the `node`
| binary, this JavaScript entrypoint registers the TypeScript loader
| before importing the Ace CLI handler (`bin/console.ts`).
|
| This file is invoked by `pnpm run build`, `pnpm run dev`, and any
| direct call like `node ace <command>`.
|
*/

/**
 * North star — the TypeScript loader must be registered BEFORE any
 * `.ts` file is imported, so we register it synchronously here using
 * the Node.js `register` API introduced in Node 20.6+.
 */
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

register('ts-node-maintained/register/esm', pathToFileURL('./'))

await import('./bin/console.js')
