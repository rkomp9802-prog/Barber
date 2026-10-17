import type { AdminLoginInput } from '@barber/shared'
import { AppError } from '../../errors'
import { SESSION_TTL_MS, generateSessionToken, hashSessionToken, isWellFormedSessionToken } from '../auth/session'
import type { AdminSessionRecord } from '../repositories/types'
import { adminNow, type AdminContext } from './context'

export type IssuedSession = {
  readonly token: string
  readonly expiresAt: Date
  readonly adminUserId: string
  readonly login: string
}

/**
 * Вход администратора. Порядок: задержка после неудач по логину → поиск → Argon2 (на неизвестный
 * логин тоже считаем хеш, чтобы время ответа не выдавало существование логина) → сессия.
 * Пароль и токен в логи не попадают.
 */
export async function loginAdmin(ctx: AdminContext, input: AdminLoginInput): Promise<IssuedSession> {
  if ((await ctx.throttle.retryAfterMs(input.login)) > 0) {
    throw new AppError('RATE_LIMITED', 'Слишком много неудачных входов. Подождите и попробуйте снова')
  }
  const user = await ctx.admin.auth.findUserByLogin(input.login)
  const passwordOk = await checkPassword(ctx, user?.passwordHash, input.password)
  if (!user || !passwordOk) {
    await ctx.throttle.recordFailure(input.login)
    throw new AppError('UNAUTHORIZED', 'Неверный логин или пароль')
  }
  await ctx.throttle.recordSuccess(input.login)
  const now = adminNow(ctx)
  const token = generateSessionToken()
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS)
  await ctx.admin.auth.deleteExpiredSessions(user.id, now)
  await ctx.admin.auth.createSession({ adminUserId: user.id, tokenHash: hashSessionToken(token), expiresAt })
  return { token, expiresAt, adminUserId: user.id, login: user.login }
}

async function checkPassword(ctx: AdminContext, passwordHash: string | undefined, password: string): Promise<boolean> {
  if (passwordHash === undefined) {
    await ctx.passwords.verifyDummy(password)
    return false
  }
  return ctx.passwords.verify(passwordHash, password)
}

/** Удаляет сессию из базы. Неверный или пустой токен — просто ничего не делаем. */
export async function logoutAdmin(ctx: AdminContext, token: string | undefined): Promise<void> {
  if (!token || !isWellFormedSessionToken(token)) return
  await ctx.admin.auth.deleteSession(hashSessionToken(token))
}

/** Проверка сессии для защищённых маршрутов: нет токена или сессия истекла → UNAUTHORIZED. */
export async function requireSession(ctx: AdminContext, token: string | undefined): Promise<AdminSessionRecord> {
  if (!token || !isWellFormedSessionToken(token)) throw new AppError('UNAUTHORIZED')
  const session = await ctx.admin.auth.findActiveSession(hashSessionToken(token), adminNow(ctx))
  if (!session) throw new AppError('UNAUTHORIZED')
  return session
}
