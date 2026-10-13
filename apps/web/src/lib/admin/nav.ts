export type AdminNavItem = {
  href: string
  label: string
}

/** Разделы боковой панели админки. Страницы, кроме «Записей», создаются отдельными этапами. */
export const ADMIN_NAV_ITEMS: readonly AdminNavItem[] = [
  { href: '/admin/bookings', label: 'Записи' },
  { href: '/admin/services', label: 'Услуги' },
  { href: '/admin/barbers', label: 'Барберы' },
  { href: '/admin/time-off', label: 'Исключения' },
  { href: '/admin/reviews', label: 'Отзывы' },
  { href: '/admin/settings', label: 'Настройки' },
]

/** Раздел активен и на своей странице, и на вложенных (например, /admin/bookings/123). */
export function isNavItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}
