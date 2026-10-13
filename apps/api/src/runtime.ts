import { existsSync } from 'node:fs'
import type { FastifyInstance } from 'fastify'
import { buildApp } from './app'
import { loadAdminConfig } from './admin/config'
import { createAdminRoutes } from './admin/routes'
import { createPrismaAdminRepositories } from './admin/repositories/prisma'
import { loadConfig, type AppConfig } from './config'
import { createDb } from './db/prisma'
import { createPrismaRepositories } from './repositories/prisma'
import { attachTelegram, createTelegramParts } from './telegram/setup'

/** Локально подхватывает apps/api/.env (на Vercel переменные задаются в настройках проекта). */
export function loadLocalEnv(): void {
  if (existsSync('.env')) process.loadEnvFile('.env')
}

/** Реальное приложение: конфиг из окружения + Prisma. Общая точка для server.ts и Vercel. */
export async function createProductionApp(config: AppConfig = loadConfig()): Promise<FastifyInstance> {
  const db = createDb({ connectionString: config.databaseUrl, poolMax: config.dbPoolMax })
  const repos = createPrismaRepositories(db)
  // Уведомления бота нужны приложению при сборке; логгер появляется после buildApp, поэтому берём его лениво.
  const telegram = createTelegramParts(config, db, repos, () => app.log)
  const admin = createAdminRoutes({
    repos: createPrismaAdminRepositories(db),
    config: loadAdminConfig(config.corsOrigins),
  })
  const app = await buildApp({ config, repos, notifier: telegram?.notifier, extraRoutes: [admin] })
  if (telegram) await attachTelegram(app, telegram, config, db, repos)
  app.addHook('onClose', async () => {
    await db.$disconnect()
  })
  return app
}
