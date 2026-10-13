import type { TelegramAuthConfig } from '../auth/telegram-client'
import type { ServiceContext } from '../services/context'

/** Опции, которые получает каждый плагин маршрутов. */
export type RouteDeps = {
  readonly ctx: ServiceContext
  readonly telegram: TelegramAuthConfig
  /** Лимит POST /bookings в минуту с одного IP. */
  readonly bookingRateLimitMax: number
}
