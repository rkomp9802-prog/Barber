import { ADMIN_CSRF_HEADER, ADMIN_CSRF_VALUE } from '@barber/shared'
import type { onRequestAsyncHookHandler } from 'fastify'
import { AppError } from '../../errors'
import { SESSION_COOKIE_NAME } from '../auth/session'
import type { AdminConfig } from '../config'
import type { AdminSessionRecord } from '../repositories/types'
import { requireSession } from '../services/auth'
import type { AdminContext } from '../services/context'

declare module 'fastify' {
  interface FastifyRequest {
    /** Заполняет sessionGuard для защищённых маршрутов админки. */
    adminSession: AdminSessionRecord | null
  }
}

const SAFE_METHODS: ReadonlySet<string> = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * Для изменяющих запросов: Origin (если есть) из разрешённого списка и обязательный заголовок
 * x-requested-with: barber-admin. Браузер не отправит его кросс-доменно без CORS preflight.
 */
export function csrfGuard(config: AdminConfig): onRequestAsyncHookHandler {
  const allowedOrigins = new Set(config.allowedOrigins)
  return async request => {
    if (SAFE_METHODS.has(request.method)) return
    const origin = request.headers.origin
    if (origin !== undefined && !allowedOrigins.has(origin)) throw new AppError('FORBIDDEN')
    if (request.headers[ADMIN_CSRF_HEADER] !== ADMIN_CSRF_VALUE) throw new AppError('FORBIDDEN')
  }
}

/** Требует действующую сессию (cookie) → иначе 401 UNAUTHORIZED. */
export function sessionGuard(ctx: AdminContext): onRequestAsyncHookHandler {
  return async request => {
    request.adminSession = await requireSession(ctx, request.cookies[SESSION_COOKIE_NAME])
  }
}
