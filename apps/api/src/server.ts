import { loadConfig } from './config'
import { createProductionApp, loadLocalEnv } from './runtime'

/** Локальный запуск: npm run dev -w @barber/api → http://localhost:4000 */
async function main(): Promise<void> {
  loadLocalEnv()
  const config = loadConfig()
  const app = await createProductionApp(config)
  const shutdown = async (): Promise<void> => {
    await app.close()
    process.exit(0)
  }
  process.once('SIGINT', () => void shutdown())
  process.once('SIGTERM', () => void shutdown())
  await app.listen({ port: config.port, host: config.host })
}

main().catch((error: unknown) => {
  // Логгер Fastify ещё может быть не создан (например, неверный .env) — пишем в stderr.
  process.stderr.write(`Не удалось запустить API: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})
