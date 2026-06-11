import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'

export type DrizzleDB = ReturnType<typeof createDb>

export function createDb(path: string = ':memory:'): ReturnType<typeof drizzle<typeof schema>> {
  const sqlite = new Database(path)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  return drizzle(sqlite, { schema })
}
