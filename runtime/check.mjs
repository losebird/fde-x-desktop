import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { databaseHealth, openDatabase } from './db.mjs'
import { inspectAdapters } from './adapters.mjs'

const runtimeDirectory = fileURLToPath(new URL('.', import.meta.url))
const databasePath = process.env.FDE_DATABASE_PATH ?? resolve(runtimeDirectory, 'data', 'fde-workstation.sqlite')
const migrationsDirectory = resolve(runtimeDirectory, 'migrations')
const db = openDatabase(databasePath, migrationsDirectory)

try {
  const persistence = databaseHealth(db, databasePath)
  const adapters = await inspectAdapters()
  console.log(JSON.stringify({ persistence, adapters }, null, 2))
  if (persistence.state !== 'healthy') process.exitCode = 1
} finally {
  db.close()
}
