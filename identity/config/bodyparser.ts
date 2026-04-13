import { defineConfig } from '@adonisjs/core/bodyparser'

export default defineConfig({
  allowedMethods: ['POST', 'PUT', 'PATCH', 'DELETE'],
  form: {
    convertEmptyStringsToNull: true,
    types: ['application/x-www-form-urlencoded'],
  },
  json: {
    convertEmptyStringsToNull: true,
    types: [
      'application/json',
      'application/json-patch+json',
      'application/vnd.api+json',
      'application/csp-report',
    ],
  },
  raw: {
    types: ['text/*'],
  },
  multipart: {
    autoProcess: true,
    convertEmptyStringsToNull: true,
    processManually: [],
    types: ['multipart/form-data'],
    maxSize: '20mb',
  },
})
