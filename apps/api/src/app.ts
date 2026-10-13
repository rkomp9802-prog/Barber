import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import { TELEGRAM_INIT_DATA_HEADER } from '@barber/shared'
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify'
import type { AppConfig } from './config'
import { AppError, registerErrorHandling } from './errors'
import { maskTokenInUrl } from './lib/tokens'
import { noopNotifier, type Notifier } from './notifications/notifier'
import { registerRoutes, type RoutePlugin } from './routes'
import type { Repositories } from './repositories/types'
import type { ServiceContext } from './services/context'

/** Часть конфигурации, нужная HTTP-приложению (тесты собирают её вручную). */
export type AppHttpConfig = Pick<AppConfig, 'corsOrigins' | 'telegram' | 'rateLimit' | 'trustProxy' | 'logLevel'>

/** Зависимости приложения. Всё внешнее передаётся снаружи — так тесты подставляют подделки. */
export type AppDeps = {
  readonly config: AppHttpConfig
  readonly repos: Repositories
  /** Telegram-бот (этап 7) передаст сюда свою реализацию. */
  readonly notifier?: Notifier
  /** Источник текущего времени (мс). */
  readonly now?: () => number
  /** false — без логов (тесты). По умолчанию pino с маскировкой токенов. */
  readonly logger?: FastifyServerOptions['logger']
  /** Дополнительные маршруты под /api/v1: админка, Telegram webhook. */
  readonly extraRoutes?: readonly RoutePlugin[]
}

const ONE_MINUTE = '1 minute'
const CORS_MAX_AGE_SEC = 600
const BODY_LIMIT_BYTES = 64 * 1024

function defaultLogger(level: string): FastifyServerOptions['logger'] {
  return {
    level,
    // Не пишем в логи токены записей, телефоны и initData: тело и заголовки не логируются,
    // а токен из URL маскируется.
    serializers: {
      req: request => ({ method: request.method, url: maskTokenInUrl(request.url), reqId: request.id }),
    },
  }
}

async function registerSecurity(app: FastifyInstance, config: AppHttpConfig): Promise<void> {
  const allowed = new Set(config.corsOrigins)
  await app.register(cors, {
    origin: (origin, callback) => callback(null, !origin || allowed.has(origin)),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    // x-requested-with — CSRF-заголовок админки (ADMIN_CSRF_HEADER).
    allowedHeaders: ['content-type', TELEGRAM_INIT_DATA_HEADER, 'x-requested-with'],
    credentials: true,
    maxAge: CORS_MAX_AGE_SEC,
  })
  await app.register(rateLimit, {
    global: true,
    max: config.rateLimit.globalMax,
    timeWindow: ONE_MINUTE,
    errorResponseBuilder: () => new AppError('RATE_LIMITED'),
  })
  await app.register(cookie)
}

/** Собирает Fastify-приложение. Не слушает порт — это делают server.ts и api/index.ts. */
export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const { config } = deps
  const app = Fastify({
    logger: deps.logger ?? defaultLogger(config.logLevel),
    trustProxy: config.trustProxy,
    bodyLimit: BODY_LIMIT_BYTES,
  })
  registerErrorHandling(app)
  await registerSecurity(app, config)
  const ctx: ServiceContext = {
    repos: deps.repos,
    notifier: deps.notifier ?? noopNotifier,
    now: deps.now ?? Date.now,
    telegramBotUsername: config.telegram.botUsername,
  }
  await registerRoutes(
    app,
    { ctx, telegram: config.telegram, bookingRateLimitMax: config.rateLimit.bookingMax },
    deps.extraRoutes,
  )
  return app
}
