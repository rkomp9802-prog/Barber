import { z } from 'zod'

const DEFAULT_PORT = 4000
/** Локальные origin: сайт (Next.js) и Mini App (Vite). */
const DEFAULT_CORS = 'http://localhost:3000,http://localhost:5173,http://localhost:5174'

const csv = z
  .string()
  .transform(value =>
    value
      .split(',')
      .map(item => item.trim())
      .filter(Boolean),
  )

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform(value => (value ? value : undefined))

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(DEFAULT_PORT),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//,'DATABASE_URL должен быть строкой подключения PostgreSQL'),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(50).default(5),
  CORS_ORIGINS: z
    .string()
    .default(DEFAULT_CORS)
    .pipe(csv),
  TELEGRAM_BOT_TOKEN: optionalString,
  TELEGRAM_BOT_USERNAME: optionalString,
  TELEGRAM_INIT_DATA_MAX_AGE_SEC: z.coerce.number().int().min(60).default(24 * 60 * 60),
  // Telegram допускает в secret_token только A-Z, a-z, 0-9, _ и - (1–256 символов); требуем минимум 16.
  TELEGRAM_WEBHOOK_SECRET: optionalString.pipe(
    z.string().regex(/^[A-Za-z0-9_-]{16,256}$/, 'TELEGRAM_WEBHOOK_SECRET: 16–256 символов A-Z a-z 0-9 _ -').optional(),
  ),
  MINIAPP_URL: optionalString,
  APP_URL: optionalString,
  API_URL: optionalString,
  RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(100),
  BOOKING_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(10),
  TRUST_PROXY: z
    .enum(['true', 'false'])
    .default('true')
    .transform(value => value === 'true'),
})

/** Настройки приложения из переменных окружения. Секреты берутся только отсюда. */
export type AppConfig = {
  readonly nodeEnv: 'development' | 'test' | 'production'
  readonly port: number
  readonly host: string
  readonly logLevel: string
  readonly databaseUrl: string
  readonly dbPoolMax: number
  readonly corsOrigins: readonly string[]
  readonly telegram: {
    readonly botToken: string | undefined
    readonly botUsername: string | undefined
    readonly initDataMaxAgeSec: number
  }
  readonly appUrl: string | undefined
  readonly apiUrl: string | undefined
  /** Telegram-бот (этап 7): webhook и кнопка Mini App. */
  readonly bot: {
    readonly webhookSecret: string | undefined
    readonly miniAppUrl: string | undefined
  }
  readonly rateLimit: { readonly globalMax: number; readonly bookingMax: number }
  readonly trustProxy: boolean
}

/** Читает и проверяет окружение. При ошибке падает сразу с понятным сообщением (fail fast). */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = envSchema.safeParse(env)
  if (!result.success) {
    const problems = result.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; ')
    throw new Error(`Неверные переменные окружения: ${problems}`)
  }
  const e = result.data
  return {
    nodeEnv: e.NODE_ENV,
    port: e.PORT,
    host: e.HOST,
    logLevel: e.LOG_LEVEL,
    databaseUrl: e.DATABASE_URL,
    dbPoolMax: e.DB_POOL_MAX,
    corsOrigins: e.CORS_ORIGINS,
    telegram: {
      botToken: e.TELEGRAM_BOT_TOKEN,
      botUsername: e.TELEGRAM_BOT_USERNAME?.replace(/^@/, ''),
      initDataMaxAgeSec: e.TELEGRAM_INIT_DATA_MAX_AGE_SEC,
    },
    appUrl: e.APP_URL,
    apiUrl: e.API_URL,
    bot: { webhookSecret: e.TELEGRAM_WEBHOOK_SECRET, miniAppUrl: e.MINIAPP_URL },
    rateLimit: { globalMax: e.RATE_LIMIT_MAX, bookingMax: e.BOOKING_RATE_LIMIT_MAX },
    trustProxy: e.TRUST_PROXY,
  }
}
