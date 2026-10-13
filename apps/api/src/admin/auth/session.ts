import { ADMIN_SESSION_COOKIE, ADMIN_SESSION_TTL_DAYS } from '@barber/shared'
import type { CookieSerializeOptions } from '@fastify/cookie'
import { createHash, randomBytes } from 'node:crypto'
import { DAY_MS } from '../../domain/time'
import type { AdminConfig } from '../config'

const SESSION_TOKEN_BYTES = 32
/** 32 байта в base64url без паддинга — 43 символа. */
const SESSION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/

export const SESSION_TTL_MS = ADMIN_SESSION_TTL_DAYS * DAY_MS
export const SESSION_COOKIE_NAME = ADMIN_SESSION_COOKIE

/** Случайный токен сессии. В cookie — сам токен, в базе — только его SHA-256. */
export function generateSessionToken(): string {
  return randomBytes(SESSION_TOKEN_BYTES).toString('base64url')
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function isWellFormedSessionToken(token: string): boolean {
  return SESSION_TOKEN_PATTERN.test(token)
}

/**
 * Параметры cookie сессии: httpOnly (недоступна JS), path=/, SameSite и Secure из конфига
 * (почему так — см. admin/config.ts). expiresAt = null — удалить cookie.
 */
export function sessionCookieOptions(config: AdminConfig, expiresAt: Date | null): CookieSerializeOptions {
  const base: CookieSerializeOptions = {
    httpOnly: true,
    secure: config.cookie.secure,
    sameSite: config.cookie.sameSite,
    path: '/',
    ...(config.cookie.domain ? { domain: config.cookie.domain } : {}),
  }
  return expiresAt ? { ...base, expires: expiresAt } : { ...base, expires: new Date(0), maxAge: 0 }
}
