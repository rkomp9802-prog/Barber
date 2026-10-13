/** Куда вести администратора после входа, если в ссылке ничего безопасного не указано. */
export const ADMIN_HOME_PATH = '/admin/bookings'

const ADMIN_PREFIX = '/admin/'
const LOGIN_PATH = '/admin/login'

/**
 * Параметр next приходит из адресной строки, поэтому пропускаем только внутренние пути админки.
 * Всё остальное (внешние адреса, протокол-относительные ссылки, служебные символы) — на главную админки.
 */
export function sanitizeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith(ADMIN_PREFIX)) return ADMIN_HOME_PATH
  if (value.startsWith(LOGIN_PATH)) return ADMIN_HOME_PATH
  if (value.includes('://') || value.includes('\\') || /[\u0000-\u001f\s]/.test(value)) return ADMIN_HOME_PATH
  return value
}

/** Адрес входа с возвратом на текущую страницу. */
export function loginHref(pathname: string): string {
  return `${LOGIN_PATH}?next=${encodeURIComponent(sanitizeNextPath(pathname))}`
}
