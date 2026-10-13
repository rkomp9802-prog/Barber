import { adminLoginSchema } from '@barber/shared'
import type { FastifyInstance } from 'fastify'
import { AppError } from '../../errors'
import { SESSION_COOKIE_NAME, sessionCookieOptions } from '../auth/session'
import { loginAdmin, logoutAdmin } from '../services/auth'
import type { AdminContext } from '../services/context'
import { toMeDto } from '../services/mappers'

const ONE_MINUTE = '1 minute'

/** POST /admin/login и POST /admin/logout — без сессии (логин ещё не выдан). */
export async function adminAuthRoutes(app: FastifyInstance, ctx: AdminContext): Promise<void> {
  app.post(
    '/login',
    { config: { rateLimit: { max: ctx.config.loginRateLimitMax, timeWindow: ONE_MINUTE } } },
    async (request, reply) => {
      const input = adminLoginSchema.parse(request.body)
      const issued = await loginAdmin(ctx, input)
      reply.setCookie(SESSION_COOKIE_NAME, issued.token, sessionCookieOptions(ctx.config, issued.expiresAt))
      return toMeDto({ adminUserId: issued.adminUserId, login: issued.login, expiresAt: issued.expiresAt })
    },
  )

  app.post('/logout', async (request, reply) => {
    await logoutAdmin(ctx, request.cookies[SESSION_COOKIE_NAME])
    reply.setCookie(SESSION_COOKIE_NAME, '', sessionCookieOptions(ctx.config, null))
    return reply.status(204).send()
  })
}

/** GET /admin/me — требует сессию (sessionGuard уже проверил). */
export async function adminMeRoute(app: FastifyInstance): Promise<void> {
  app.get('/me', async request => {
    const session = request.adminSession
    if (!session) throw new AppError('UNAUTHORIZED')
    return toMeDto(session)
  })
}
