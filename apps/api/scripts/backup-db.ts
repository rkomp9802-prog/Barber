/**
 * Резервная копия данных: каждая таблица схемы public → JSON-файл в backups/<дата-время>/.
 * Схема таблиц хранится в prisma/migrations, поэтому копируем только данные.
 *
 *   npm run db:backup -w @barber/api
 *
 * В копии есть телефоны и имена клиентов: папка backups/ в .gitignore, не отправляйте её никуда.
 * Подключение — DIRECT_URL из apps/api/.env (прямое, не через пулер), с шифрованием.
 */
import 'dotenv/config'
import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import pg from 'pg'
import { sslOptions } from '../src/db/prisma'

async function main(): Promise<void> {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL
  if (!url) throw new Error('Нет DIRECT_URL/DATABASE_URL в apps/api/.env')

  const client = new pg.Client({ connectionString: url, ssl: sslOptions(url) })
  await client.connect()
  try {
    const { rows: tables } = await client.query<{ name: string }>(
      `SELECT c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind = 'r' ORDER BY 1`,
    )
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const dir = resolve(import.meta.dirname, '..', '..', '..', 'backups', stamp)
    await mkdir(dir, { recursive: true })

    // Одна транзакция REPEATABLE READ: все таблицы — на один и тот же момент времени.
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
    for (const { name } of tables) {
      const { rows } = await client.query(`SELECT * FROM public.${pg.escapeIdentifier(name)}`)
      await writeFile(join(dir, `${name}.json`), JSON.stringify(rows, null, 2))
      console.log(`${name}: ${rows.length}`)
    }
    await client.query('COMMIT')
    console.log(`Готово: ${dir}`)
  } finally {
    await client.end()
  }
}

main().catch((error: unknown) => {
  console.error('Резервная копия не сделана:', error instanceof Error ? error.message : error)
  process.exitCode = 1
})
