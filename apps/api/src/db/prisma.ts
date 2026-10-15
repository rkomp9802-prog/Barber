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
  const adapter = new PrismaPg({
    connectionString: options.connectionString,
    max: options.poolMax,
    ssl: sslOptions(options.connectionString),
  })
  return new PrismaClient({ adapter })
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

/**
 * Без ssl node-postgres подключается открытым текстом — вместе с паролем от базы.
 * Сертификат Supabase подписан их собственным CA, поэтому цепочку не проверяем: канал шифруется,
 * но без защиты от подмены сервера. Локальную базу (тесты, PGlite) и sslmode=disable не трогаем.
 * Если sslmode задан в самой строке подключения, node-postgres возьмёт его оттуда.
 */
export function sslOptions(connectionString: string): false | { rejectUnauthorized: false } {
  try {
    const url = new URL(connectionString)
    if (url.searchParams.get('sslmode') === 'disable' || LOCAL_HOSTS.has(url.hostname)) return false
  } catch {
    // Строку не разобрать — безопаснее шифровать.
  }
  return { rejectUnauthorized: false }
}
