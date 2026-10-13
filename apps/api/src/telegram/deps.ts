import type { FastifyBaseLogger } from 'fastify'
import type { ServiceContext } from '../services/context'
import type { TelegramRepository } from './repository'

/** Всё, что нужно обработчикам бота. Собирается в setup.ts (продакшен) или в тестах. */
export type BotDeps = {
  /** Те же сервисы, что у HTTP API: правила отмены, уведомления, репозитории. */
  readonly ctx: ServiceContext
  readonly repo: TelegramRepository
  /** https-адрес Mini App для кнопки «Записаться». */
  readonly miniAppUrl: string | undefined
  /** Адрес сайта: контакты и страница управления записью /booking/<token>. */
  readonly appUrl: string | undefined
  readonly log: FastifyBaseLogger
}

/** Telegram-пользователь, от имени которого пришло обновление. */
export type TelegramActor = {
  readonly telegramId: bigint
  readonly chatId: bigint
}
