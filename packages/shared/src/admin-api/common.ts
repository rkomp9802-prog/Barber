import { z } from 'zod'

export const ADMIN_API_PREFIX = '/admin'
export const ADMIN_CSRF_HEADER = 'x-requested-with'
export const ADMIN_CSRF_VALUE = 'barber-admin'
/** Срок жизни сессии администратора. */
export const ADMIN_SESSION_TTL_DAYS = 7

/* ---------- Пагинация ---------- */

export const ADMIN_PAGE_SIZE_DEFAULT = 20
export const ADMIN_PAGE_SIZE_MAX = 100

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(ADMIN_PAGE_SIZE_MAX).default(ADMIN_PAGE_SIZE_DEFAULT),
})

export type Paginated<T> = {
  items: T[]
  total: number
  page: number
  pageSize: number
}

/** DELETE для сущностей с историей: удаляем, если ссылок нет, иначе скрываем (is_active=false). */
export type AdminDeleteResult = { mode: 'deleted' | 'deactivated' }

/* ---------- Авторизация ---------- */
// POST /admin/login  body: AdminLoginInput (adminLoginSchema из api.ts) → 200 AdminMeDto + Set-Cookie
// POST /admin/logout → 204, cookie очищается
// GET  /admin/me     → AdminMeDto

export type AdminMeDto = {
  id: string
  login: string
  /** Когда истечёт текущая сессия (ISO UTC). */
  sessionExpiresAt: string
}

