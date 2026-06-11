import { createDb } from '../lib/db/client'
import { runMigrations } from '../lib/db/migrate'
import { buildApp } from './app'

const PORT = parseInt(process.env.PORT ?? '3000', 10)
const HOST = process.env.HOST ?? '0.0.0.0'
const DB_PATH = process.env.DB_PATH ?? 'po.db'

async function main(): Promise<void> {
  const db = createDb(DB_PATH)
  runMigrations(db)

  const testMode = process.env.AUTH_DISABLED === 'true'
  const app = await buildApp(db, { logger: true, auth: { testMode } })

  try {
    const address = await app.listen({ port: PORT, host: HOST })
    app.log.info(`Server listening at ${address}`)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

main()
