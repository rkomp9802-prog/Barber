/**
 * Работа со временем барбершопа. В базе — UTC, расписание задаётся как 'HH:MM' по часовому поясу салона.
 * Все функции чистые: «сейчас» всегда передаётся аргументом.
 */

export const MINUTE_MS = 60_000
export const DAY_MS = 24 * 60 * MINUTE_MS
const MINUTES_IN_DAY = 24 * 60

const HHMM_PATTERN = /^([01]\d|2[0-4]):([0-5]\d)$/
const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

/** Полуоткрытый интервал [start, end) в миллисекундах UTC. */
export type Interval = { readonly start: number; readonly end: number }

/** 'HH:MM' → минуты от начала дня. '24:00' допустимо как конец дня. */
export function parseHhmm(value: string): number {
  const match = HHMM_PATTERN.exec(value)
  if (!match) throw new Error(`Неверный формат времени: ${value}`)
  const minutes = Number(match[1]) * 60 + Number(match[2])
  if (minutes > MINUTES_IN_DAY) throw new Error(`Неверное время: ${value}`)
  return minutes
}

function parseDateKey(dateKey: string): { year: number; month: number; day: number } {
  const match = DATE_KEY_PATTERN.exec(dateKey)
  if (!match) throw new Error(`Неверная дата: ${dateKey}`)
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) }
}

const partsFormatterCache = new Map<string, Intl.DateTimeFormat>()

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = partsFormatterCache.get(timeZone)
  if (cached) return cached
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  partsFormatterCache.set(timeZone, formatter)
  return formatter
}

type ZonedParts = { year: number; month: number; day: number; hour: number; minute: number; second: number }

function zonedParts(epochMs: number, timeZone: string): ZonedParts {
  const parts = partsFormatter(timeZone).formatToParts(new Date(epochMs))
  const read = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find(part => part.type === type)?.value ?? '0')
  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour'),
    minute: read('minute'),
    second: read('second'),
  }
}

/** Смещение пояса относительно UTC в минутах в данный момент (Ташкент: +300). */
export function zoneOffsetMin(epochMs: number, timeZone: string): number {
  const p = zonedParts(epochMs, timeZone)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  const truncated = epochMs - (epochMs % 1000)
  return Math.round((asUtc - truncated) / MINUTE_MS)
}

/** Местные дата + минуты от полуночи → момент UTC (мс). */
export function zonedToUtc(dateKey: string, minutesOfDay: number, timeZone: string): number {
  const { year, month, day } = parseDateKey(dateKey)
  const naive = Date.UTC(year, month - 1, day) + minutesOfDay * MINUTE_MS
  const firstGuess = naive - zoneOffsetMin(naive, timeZone) * MINUTE_MS
  // Второй проход уточняет результат около переходов на летнее время (в Ташкенте их нет).
  return naive - zoneOffsetMin(firstGuess, timeZone) * MINUTE_MS
}

/** Момент → 'YYYY-MM-DD' в поясе салона. */
export function dateKeyInZone(epochMs: number, timeZone: string): string {
  const p = zonedParts(epochMs, timeZone)
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`
}

/** Момент → 'HH:MM' в поясе салона. */
export function timeInZone(epochMs: number, timeZone: string): string {
  const p = zonedParts(epochMs, timeZone)
  return `${pad2(p.hour)}:${pad2(p.minute)}`
}

/** '2026-10-05' + 3 → '2026-10-08'. */
export function addDaysToKey(dateKey: string, days: number): string {
  const { year, month, day } = parseDateKey(dateKey)
  return new Date(Date.UTC(year, month - 1, day) + days * DAY_MS).toISOString().slice(0, 10)
}

/** 0 = воскресенье … 6 = суббота. */
export function weekdayOfKey(dateKey: string): number {
  const { year, month, day } = parseDateKey(dateKey)
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay()
}

/** Границы местного дня в UTC: [00:00, 24:00). */
export function dayBoundsUtc(dateKey: string, timeZone: string): Interval {
  return {
    start: zonedToUtc(dateKey, 0, timeZone),
    end: zonedToUtc(addDaysToKey(dateKey, 1), 0, timeZone),
  }
}

/** Корректная ли дата (например, '2026-02-30' — нет). */
export function isValidDateKey(dateKey: string): boolean {
  if (!DATE_KEY_PATTERN.test(dateKey)) return false
  return addDaysToKey(dateKey, 0) === dateKey
}

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}
