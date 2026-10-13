import { ADMIN_API_PREFIX } from '@barber/shared'
import type { FastifyInstance } from 'fastify'
import type { RoutePlugin } from '../../routes'
import { createArgon2Verifier, type PasswordVerifier } from '../auth/passwords'
import { LoginThrottle } from '../auth/login-throttle'
import type { AdminConfig } from '../config'
import type { AdminRepositories } from '../repositories/types'
import type { AdminContext } from '../services/context'
import { adminAuthRoutes, adminMeRoute } from './auth'
import { adminBarberRoutes } from './barbers'
import { adminBookingRoutes } from './bookings'
import { adminServiceRoutes, adminTimeOffRoutes } from './catalog-time-off'
import { adminPortfolioRoutes } from './portfolio'
import { adminReviewRoutes, adminSettingsRoutes } from './reviews-settings'
import { csrfGuard, sessionGuard } from './guards'

export type AdminRouteOptions = {
  readonly repos: AdminRepositories
  readonly config: AdminConfig
  /** По умолчанию — Argon2; тесты могут подменить. */
  readonly passwords?: PasswordVerifier
}

/**
 * Плагин маршрутов админки под /api/v1/admin. Передаётся в buildApp({ extraRoutes }).
 * Порядок защиты: CSRF-заголовок для всех изменяющих запросов → сессия для всего, кроме login/logout.
 */
export function createAdminRoutes(options: AdminRouteOptions): RoutePlugin {
  return async (app, deps) => {
    const ctx: AdminContext = {
      admin: options.repos,
      core: deps.ctx,
      config: options.config,
      passwords: options.passwords ?? createArgon2Verifier(),
      throttle: new LoginThrottle(deps.ctx.now),
    }
    await app.register(async admin => registerAdmin(admin, ctx), { prefix: ADMIN_API_PREFIX })
  }
}

async function registerAdmin(admin: FastifyInstance, ctx: AdminContext): Promise<void> {
  admin.decorateRequest('adminSession', null)
  admin.addHook('onRequest', csrfGuard(ctx.config))
  await admin.register(async open => adminAuthRoutes(open, ctx))
  await admin.register(async secured => {
    secured.addHook('onRequest', sessionGuard(ctx))
    await secured.register(adminMeRoute)
    await secured.register(async scope => adminBarberRoutes(scope, ctx))
    await secured.register(async scope => adminPortfolioRoutes(scope, ctx))
    await secured.register(async scope => adminServiceRoutes(scope, ctx))
    await secured.register(async scope => adminTimeOffRoutes(scope, ctx))
    await secured.register(async scope => adminBookingRoutes(scope, ctx))
    await secured.register(async scope => adminReviewRoutes(scope, ctx))
    await secured.register(async scope => adminSettingsRoutes(scope, ctx))
  })
}
