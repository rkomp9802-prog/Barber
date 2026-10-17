/**
 * Supabase Edge Function «notifications» (этап 8).
 *
 * Вызывается Supabase Cron каждые 5 минут (см. supabase/migrations/*_notifications_cron.sql)
 * и выполняет фоновые задачи из spec §12: напоминания, автозавершение, запрос отзыва.
 *
 * Переменные окружения:
 *   SUPABASE_DB_URL     — задаёт Supabase автоматически;
 *   TELEGRAM_BOT_TOKEN  — `supabase secrets set`;
 *   CRON_SECRET         — `supabase secrets set`, тот же секрет хранится в Vault для pg_cron.
 *
 * verify_jwt выключен (config.toml): вместо JWT функция требует «Authorization: Bearer <CRON_SECRET>».
 */
import { BATCH_SIZE, isAuthorized, isSecretConfigured } from './logic.ts'
import { runAllJobs, type RunSummary } from './jobs.ts'
import { createTelegramSender } from './telegram.ts'
import { connect, createRepo } from './db.ts'

interface Env {
  readonly dbUrl: string
  readonly botToken: string
  readonly cronSecret: string
}

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

function readEnv(): Env | null {
  const dbUrl = Deno.env.get('SUPABASE_DB_URL')
  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')
  const cronSecret = Deno.env.get('CRON_SECRET')
  if (!dbUrl || !botToken || !isSecretConfigured(cronSecret)) return null
  return { dbUrl, botToken, cronSecret }
}

/** Логируем только имя задачи и текст ошибки: без токенов, телефонов и chat_id. */
function logError(job: string, error: unknown): void {
  const message = error instanceof Error ? error.message : 'unknown error'
  console.error(JSON.stringify({ event: 'notifications_job_failed', job, message }))
}

async function run(env: Env): Promise<RunSummary> {
  const sql = connect(env.dbUrl)
  try {
    return await runAllJobs({
      repo: createRepo(sql),
      send: createTelegramSender(env.botToken),
      now: () => new Date(),
      batchSize: BATCH_SIZE,
      logError,
    })
  } finally {
    await sql.end({ timeout: 5 })
  }
}

async function handle(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' })

  // Сначала секрет: чужой запрос не должен узнать даже то, настроена ли функция.
  const cronSecret = Deno.env.get('CRON_SECRET')
  if (!isSecretConfigured(cronSecret) || !isAuthorized(request.headers.get('Authorization'), cronSecret)) {
    if (!isSecretConfigured(cronSecret)) console.error(JSON.stringify({ event: 'notifications_misconfigured' }))
    return json(401, { error: 'unauthorized' })
  }
  const env = readEnv()
  if (!env) {
    console.error(JSON.stringify({ event: 'notifications_misconfigured' }))
    return json(500, { error: 'misconfigured' })
  }

  try {
    const summary = await run(env)
    // Структурный лог: только счётчики, без персональных данных.
    console.info(JSON.stringify({ event: 'notifications_run', ...summary }))
    return json(summary.failedJobs.length === 0 ? 200 : 500, { ok: summary.failedJobs.length === 0, ...summary })
  } catch (error: unknown) {
    logError('run', error)
    return json(500, { error: 'run_failed' })
  }
}

Deno.serve(handle)
