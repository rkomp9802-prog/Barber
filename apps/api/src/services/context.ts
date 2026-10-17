import type { FastifyBaseLogger } from 'fastify'
import type { AppConfig } from '../config'
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
  /**
   * Без бота подтвердить номер нечем. Вне продакшена (локальная разработка) запись гостя тогда сразу подтверждена,
   * на продакшене — отклоняется: защита не должна молча выключаться из-за забытой переменной.
   */
  readonly allowUnverifiedGuests: boolean
  /** Ключ HMAC для IP в лимите неподтверждённых записей: простой хеш IPv4 перебирается за секунды. */
  readonly ipHashKey: string
}

/** Защита онлайн-записи гостя (см. ServiceContext): общая для HTTP-приложения и бота. */
export function guestBookingGuards(
  config: Pick<AppConfig, 'nodeEnv' | 'telegram'>,
): Pick<ServiceContext, 'allowUnverifiedGuests' | 'ipHashKey'> {
  return {
    allowUnverifiedGuests: config.nodeEnv !== 'production',
    ipHashKey: config.telegram.botToken ?? 'barber-dev-hold',
  }
}

/** Сервису нужен логгер запроса (ошибки уведомлений) и IP клиента (лимит неподтверждённых записей). */
export type RequestScope = { readonly log: FastifyBaseLogger; readonly ip?: string }

export async function loadRules(ctx: ServiceContext): Promise<BookingRules> {
  return parseBookingRules(await ctx.repos.settings.getAll())
}
