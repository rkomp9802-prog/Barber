import { randomBytes } from 'node:crypto'

const MANAGE_TOKEN_BYTES = 32
/** 32 байта в base64url без паддинга — ровно 43 символа. */
const MANAGE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/

/** Длинный случайный токен для управления записью (/booking/[token]). */
export function generateManageToken(): string {
  return randomBytes(MANAGE_TOKEN_BYTES).toString('base64url')
}

/** Отсекает заведомо неверные токены до запроса в базу. */
export function isWellFormedManageToken(token: string): boolean {
  return MANAGE_TOKEN_PATTERN.test(token)
}

/** Скрывает токен записи в URL для логов. */
export function maskTokenInUrl(url: string): string {
  return url.replace(/\/bookings\/[^/?#]+/g, '/bookings/***')
}
