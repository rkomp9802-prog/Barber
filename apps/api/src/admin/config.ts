import { ADMIN_UPLOAD_MAX_BYTES } from '@barber/shared'
import { z } from 'zod'

/**
 * Настройки админки из окружения. Читаются отдельно от общего config.ts,
 * чтобы API работал и без них (Storage необязателен).
 *
 * SameSite cookie сессии:
 * - 'lax' (по умолчанию) — сайт и API на одном «сайте» (eTLD+1), например
 *   admin.example.com и api.example.com: fetch с credentials отправляет cookie,
 *   а сторонние сайты не могут подставить её в свои POST-запросы.
 * - 'none' — сайт и API на разных сайтах (например, два домена *.vercel.app:
 *   vercel.app в Public Suffix List, поэтому это разные сайты). Тогда браузер
 *   отправит cookie только с SameSite=None; Secure — Secure включается принудительно.
 *   Защиту от CSRF в этом случае обеспечивает обязательный заголовок x-requested-with
 *   (его нельзя отправить кросс-доменно без CORS preflight) и проверка Origin.
 */

export type CookieSameSite = 'lax' | 'strict' | 'none'

export type StorageConfig = {
  readonly url: string
  readonly serviceRoleKey: string
  readonly bucket: string
  readonly maxUploadBytes: number
}

export type AdminConfig = {
  readonly cookie: {
    readonly secure: boolean
    readonly sameSite: CookieSameSite
    readonly domain: string | undefined
  }
  /** Попыток входа в минуту с одного IP. */
  readonly loginRateLimitMax: number
  /** Разрешённые Origin для изменяющих запросов (тот же список, что у CORS). */
  readonly allowedOrigins: readonly string[]
  /** undefined — загрузка фото не настроена (POST /admin/uploads → 503). */
  readonly storage: StorageConfig | undefined
}

const DEFAULT_LOGIN_RATE_LIMIT = 5
const DEFAULT_BUCKET = 'public-media'

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform(value => (value ? value : undefined))

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  ADMIN_COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  ADMIN_COOKIE_DOMAIN: optionalString,
  ADMIN_LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(100).default(DEFAULT_LOGIN_RATE_LIMIT),
  SUPABASE_URL: optionalString.pipe(z.string().url().optional()),
  SUPABASE_SERVICE_ROLE_KEY: optionalString,
  SUPABASE_STORAGE_BUCKET: optionalString.transform(value => value ?? DEFAULT_BUCKET),
  UPLOAD_MAX_BYTES: z.coerce.number().int().min(1).max(ADMIN_UPLOAD_MAX_BYTES).default(ADMIN_UPLOAD_MAX_BYTES),
})

/** Читает переменные админки. Ошибка формата — сразу исключение (fail fast). */
export function loadAdminConfig(allowedOrigins: readonly string[], env: NodeJS.ProcessEnv = process.env): AdminConfig {
  const result = envSchema.safeParse(env)
  if (!result.success) {
    const problems = result.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; ')
    throw new Error(`Неверные переменные окружения админки: ${problems}`)
  }
  const e = result.data
  const storage =
    e.SUPABASE_URL && e.SUPABASE_SERVICE_ROLE_KEY
      ? {
          url: e.SUPABASE_URL.replace(/\/+$/, ''),
          serviceRoleKey: e.SUPABASE_SERVICE_ROLE_KEY,
          bucket: e.SUPABASE_STORAGE_BUCKET,
          maxUploadBytes: e.UPLOAD_MAX_BYTES,
        }
      : undefined
  return {
    cookie: {
      // SameSite=None без Secure браузеры отклоняют.
      secure: e.NODE_ENV === 'production' || e.ADMIN_COOKIE_SAMESITE === 'none',
      sameSite: e.ADMIN_COOKIE_SAMESITE,
      domain: e.ADMIN_COOKIE_DOMAIN,
    },
    loginRateLimitMax: e.ADMIN_LOGIN_RATE_LIMIT_MAX,
    allowedOrigins,
    storage,
  }
}
