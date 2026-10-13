import { createHmac, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'

/** Пользователь Telegram из initData Mini App. */
export type TelegramUser = {
  readonly id: number
  readonly firstName: string
  readonly lastName: string | undefined
  readonly username: string | undefined
}

export type InitDataResult =
  | { readonly ok: true; readonly user: TelegramUser; readonly authDate: number }
  | { readonly ok: false; readonly reason: 'MALFORMED' | 'BAD_SIGNATURE' | 'EXPIRED' | 'NO_USER' }

const HASH_PATTERN = /^[0-9a-f]{64}$/
const FUTURE_TOLERANCE_SEC = 60

const userSchema = z.object({
  id: z.number().int().positive(),
  first_name: z.string().default(''),
  last_name: z.string().optional(),
  username: z.string().optional(),
})

/** data_check_string: все поля, кроме hash, отсортированные по ключу, в виде key=value через \n. */
export function buildDataCheckString(params: URLSearchParams): string {
  return [...params.entries()]
    .filter(([key]) => key !== 'hash')
    .toSorted(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')
}

/** Подпись initData по спецификации Telegram: secret = HMAC_SHA256(key "WebAppData", botToken). */
export function signInitData(dataCheckString: string, botToken: string): string {
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest()
  return createHmac('sha256', secret).update(dataCheckString).digest('hex')
}

function parseUser(raw: string | null): TelegramUser | null {
  if (!raw) return null
  try {
    const parsed = userSchema.safeParse(JSON.parse(raw))
    if (!parsed.success) return null
    const { id, first_name, last_name, username } = parsed.data
    return { id, firstName: first_name, lastName: last_name, username }
  } catch {
    return null
  }
}

/**
 * Проверяет initData из Telegram Mini App: HMAC-подпись (сравнение за постоянное время)
 * и срок жизни auth_date. nowSec — текущее время в секундах.
 */
export function verifyInitData(
  initData: string,
  botToken: string,
  nowSec: number,
  maxAgeSec: number,
): InitDataResult {
  const params = new URLSearchParams(initData)
  const hash = params.get('hash')
  const authDate = Number(params.get('auth_date'))
  if (!hash || !HASH_PATTERN.test(hash) || !Number.isInteger(authDate) || authDate <= 0) {
    return { ok: false, reason: 'MALFORMED' }
  }
  const expected = Buffer.from(signInitData(buildDataCheckString(params), botToken), 'hex')
  if (!timingSafeEqual(expected, Buffer.from(hash, 'hex'))) return { ok: false, reason: 'BAD_SIGNATURE' }
  if (nowSec - authDate > maxAgeSec || authDate - nowSec > FUTURE_TOLERANCE_SEC) {
    return { ok: false, reason: 'EXPIRED' }
  }
  const user = parseUser(params.get('user'))
  if (!user) return { ok: false, reason: 'NO_USER' }
  return { ok: true, user, authDate }
}

/** Отображаемое имя клиента из профиля Telegram. */
export function telegramDisplayName(user: TelegramUser): string {
  const full = [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
  return full || user.username || `Telegram ${user.id}`
}
