import type { FastifyBaseLogger } from 'fastify'
import { AppError } from '../../errors'
import type { ServiceContext } from '../../services/context'
import type { PasswordVerifier } from '../auth/passwords'
import type { LoginThrottle } from '../auth/login-throttle'
import type { AdminConfig } from '../config'
import type { AdminRepositories } from '../repositories/types'

/** Всё, что нужно сервисам админки: свои репозитории, общие бизнес-зависимости и настройки. */
export type AdminContext = {
  readonly admin: AdminRepositories
  /** Общий контекст приложения: основные репозитории, уведомления, «сейчас», имя бота. */
  readonly core: ServiceContext
  readonly config: AdminConfig
  readonly passwords: PasswordVerifier
  readonly throttle: LoginThrottle
}

/** Логгер запроса — для ошибок уведомлений (safeNotify). */
export type AdminScope = { readonly log: FastifyBaseLogger }

/** Возвращает значение или бросает NOT_FOUND. */
export function requireFound<T>(value: T | null | undefined, message: string): T {
  if (value === null || value === undefined) throw new AppError('NOT_FOUND', message)
  return value
}

/** Текущий момент для сравнений дат. */
export function adminNow(ctx: AdminContext): Date {
  return new Date(ctx.core.now())
}
