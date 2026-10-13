import { TIMEZONE } from '@barber/shared'

/*
 * Всё время в админке — по Asia/Tashkent независимо от часового пояса браузера администратора.
 */

const timeFormatter = new Intl.DateTimeFormat('ru-RU', {
  timeZone: TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
})

const dayFormatter = new Intl.DateTimeFormat('ru-RU', {
  timeZone: TIMEZONE,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
})

/** ISO-момент → «10:30» (Ташкент). */
export function formatTashkentTime(iso: string): string {
  return timeFormatter.format(new Date(iso))
}

/** ISO-момент → «пн, 13 окт.» (Ташкент). */
export function formatTashkentDay(iso: string): string {
  return dayFormatter.format(new Date(iso))
}
