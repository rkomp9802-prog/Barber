import { existsSync } from 'node:fs'
import { defineConfig } from 'prisma/config'

// Prisma 7 не читает .env сам — подхватываем локальный файл, если он есть.
if (existsSync('.env')) process.loadEnvFile('.env')

/**
 * CLI (migrate/seed) ходит в базу напрямую (DIRECT_URL, порт 5432),
 * а приложение — через пулер Supabase (DATABASE_URL, порт 6543) и driver adapter.
 * Для `prisma generate` база не нужна, поэтому url может отсутствовать.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  },
})
