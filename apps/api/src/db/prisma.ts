import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client'

export type Db = PrismaClient

export type DbOptions = {
  readonly connectionString: string
  /** Сколько соединений держит один инстанс (на Vercel — мало: функций много). */
  readonly poolMax: number
}

/**
 * Prisma 7 работает через driver adapter (node-postgres).
 * В Supabase DATABASE_URL — пулер (порт 6543, ?pgbouncer=true); подключение ленивое,
 * поэтому сервер стартует и без доступной базы (GET /health ответит).
 */
export function createDb(options: DbOptions): Db {
  const adapter = new PrismaPg({ connectionString: options.connectionString, max: options.poolMax })
  return new PrismaClient({ adapter })
}
