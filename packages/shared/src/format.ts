export const TIMEZONE = 'Asia/Tashkent'
const MINUTES_IN_HOUR = 60
const DAY_MS = 24 * 60 * 60 * 1000

const priceFormatter = new Intl.NumberFormat('ru-RU')

/** 120000 → «120 000 сум». */
export function formatPrice(amount: number): string {
  return `${priceFormatter.format(amount).replace(/ | /g, ' ')} сум`
}

/** 90 → «1 ч 30 мин», 45 → «45 мин», 120 → «2 ч». */
export function formatDuration(totalMin: number): string {
  const hours = Math.floor(totalMin / MINUTES_IN_HOUR)
  const minutes = totalMin % MINUTES_IN_HOUR
  if (hours === 0) return `${minutes} мин`
  if (minutes === 0) return `${hours} ч`
  return `${hours} ч ${minutes} мин`
}

/** Дата в Ташкенте в формате YYYY-MM-DD. */
export function tashkentDateKey(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

/** Ближайшие `count` дней, начиная с `from`, как ключи YYYY-MM-DD по Ташкенту. */
export function nextDateKeys(from: Date, count: number): string[] {
  return Array.from({ length: count }, (_, i) => tashkentDateKey(new Date(from.getTime() + i * DAY_MS)))
}

/** Полдень указанного дня по UTC: безопасная опорная точка для форматирования даты без сдвига дня. */
function dateKeyToNoon(dateKey: string): Date {
  return new Date(`${dateKey}T12:00:00Z`)
}

/** 0 = воскресенье … 6 = суббота для даты YYYY-MM-DD. */
export function weekdayOf(dateKey: string): number {
  return dateKeyToNoon(dateKey).getUTCDay()
}

/** «пн», «вт», … */
export function formatWeekdayShort(dateKey: string): string {
  return new Intl.DateTimeFormat('ru-RU', { weekday: 'short', timeZone: 'UTC' }).format(dateKeyToNoon(dateKey))
}

/** «5 октября» */
export function formatDayMonth(dateKey: string): string {
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(
    dateKeyToNoon(dateKey),
  )
}

/** «воскресенье, 5 октября» */
export function formatLongDate(dateKey: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(dateKeyToNoon(dateKey))
}

/** Склонение: plural(3, ['отзыв', 'отзыва', 'отзывов']) → «отзыва». */
export function plural(count: number, forms: readonly [string, string, string]): string {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return forms[0]
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1]
  return forms[2]
}
