import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { join } from 'path'
import { type DrizzleDB } from './client'

const MIGRATIONS_DIR = join(__dirname, '../../../drizzle')

export function runMigrations(db: DrizzleDB): void {
  migrate(db, { migrationsFolder: MIGRATIONS_DIR })
}
