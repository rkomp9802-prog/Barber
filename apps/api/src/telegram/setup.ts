import type { FastifyInstance } from 'fastify'
import { Bot } from 'grammy'
import type { AppConfig } from '../config'
import type { Db } from '../db/prisma'
import type { Notifier } from '../notifications/notifier'
import type { Repositories } from '../repositories/types'
import { guestBookingGuards, type ServiceContext } from '../services/context'
import { installHandlers } from './bot'
import type { BotDeps } from './deps'
import { createTelegramNotifier, type NotifierLogger } from './notifier'
import { PrismaTelegramRepository } from './prisma-repository'
import { telegramWebhookRoutes } from './webhook'

/**
 * Сборка Telegram-бота для продакшена. Бот включается только при заданном TELEGRAM_BOT_TOKEN.
 * Уведомления работают и без webhook (они только отправляют сообщения); webhook регистрируется,
 * только если задан TELEGRAM_WEBHOOK_SECRET: без секрета эндпоинт был бы открыт для любых запросов.
 */

/** Части бота, которые нужны до создания приложения (уведомления передаются в buildApp). */
export type TelegramParts = {
  readonly bot: Bot
  readonly notifier: Notifier
}

/** Создаёт бота и уведомления. undefined — токен не задан, Telegram выключен. */
export function createTelegramParts(
  config: AppConfig,
  db: Db,
  repos: Repositories,
  log: () => NotifierLogger,
): TelegramParts | undefined {
  const token = config.telegram.botToken
  if (!token) return undefined
  const bot = new Bot(token)
  const notifier = createTelegramNotifier({
    api: bot.api,
    repo: new PrismaTelegramRepository(db),
    settings: repos.settings,
    log,
  })
  return { bot, notifier }
}

/** Подключает обработчики команд и webhook к уже собранному приложению. */
export async function attachTelegram(
  app: FastifyInstance,
  parts: TelegramParts,
  config: AppConfig,
  db: Db,
  repos: Repositories,
): Promise<void> {
  const secret = config.bot.webhookSecret
  if (!secret) {
    app.log.warn('TELEGRAM_WEBHOOK_SECRET не задан: webhook Telegram не зарегистрирован')
    return
  }
  const ctx: ServiceContext = {
    repos,
    notifier: parts.notifier,
    now: Date.now,
    telegramBotUsername: config.telegram.botUsername,
    ...guestBookingGuards(config),
  }
  const deps: BotDeps = {
    ctx,
    repo: new PrismaTelegramRepository(db),
    miniAppUrl: config.bot.miniAppUrl,
    appUrl: config.appUrl,
    log: app.log,
  }
  installHandlers(parts.bot, deps)
  await app.register(telegramWebhookRoutes({ bot: parts.bot, secret }))
}
