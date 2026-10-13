import type { FastifyBaseLogger } from 'fastify'
import { parseBookingRules, type BookingRules } from '../domain/settings'
import type { Notifier } from '../notifications/notifier'
import type { Repositories } from '../repositories/types'

/** Зависимости бизнес-сервисов. Собирается один раз в buildApp. */
export type ServiceContext = {
  readonly repos: Repositories
  readonly notifier: Notifier
  /** Текущее время в мс (в тестах — фиксированное). */
  readonly now: () => number
  /** Имя бота для ссылки t.me/<bot>?start=b_<token>; undefined — бот не настроен. */
  readonly telegramBotUsername: string | undefined
}

/** Сервису нужен логгер запроса — для ошибок уведомлений. */
export type RequestScope = { readonly log: FastifyBaseLogger }

export async function loadRules(ctx: ServiceContext): Promise<BookingRules> {
  return parseBookingRules(await ctx.repos.settings.getAll())
}
