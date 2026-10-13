/*
 * Периоды аналитики. Даты — ключи YYYY-MM-DD в часовом поясе салона (Asia/Tashkent, UTC+5,
 * без летнего времени). Расчёт идёт арифметикой по ключам без Intl, поэтому результат
 * одинаков в браузере, на сервере и в тестах.
 */

export type DateRange = {
  /** Первый день периода, включительно. */
  from: string
  /** Последний день периода, включительно. */
  to: string
}

export type PeriodPreset = 'last7' | 'last30' | 'thisMonth' | 'lastMonth'

export const PERIOD_PRESETS: readonly { value: PeriodPreset; label: string }[] = [
  { value: 'last7', label: '7 дней' },
  { value: 'last30', label: '30 дней' },
  { value: 'thisMonth', label: 'Этот месяц' },
  { value: 'lastMonth', label: 'Прошлый месяц' },
]

export const DEFAULT_PERIOD_PRESET: PeriodPreset = 'last30'

/** Максимальная длина периода в днях (включая обе границы). */
export const MAX_PERIOD_DAYS = 366

const SALON_UTC_OFFSET_MS = 5 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000
const DATE_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/

/** Разбирает YYYY-MM-DD в UTC-полночь; null для неверного формата и несуществующих дат (30 февраля). */
function parseDateKey(value: string): Date | null {
  const match = DATE_KEY_RE.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  // Date.UTC молча переносит 30 февраля на 1 марта, поэтому сверяем части обратно.
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null
  }
  return date
}

function requireDateKey(value: string): Date {
  const date = parseDateKey(value)
  if (!date) throw new RangeError(`Некорректная дата: ${value}`)
  return date
}

function formatKey(date: Date): string {
  const year = String(date.getUTCFullYear()).padStart(4, '0')
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function isDateKey(value: string): boolean {
  return parseDateKey(value) !== null
}

/** Сегодняшняя дата салона (Ташкент) для момента `now`. */
export function tashkentToday(now: Date): string {
  return formatKey(new Date(now.getTime() + SALON_UTC_OFFSET_MS))
}

/** Сдвиг даты на `delta` дней; переходы через месяц и год учитываются. */
export function addDays(dateKey: string, delta: number): string {
  const date = requireDateKey(dateKey)
  return formatKey(new Date(date.getTime() + delta * DAY_MS))
}

/** Число дней в периоде, включая обе границы. Для невалидных дат возвращает NaN. */
export function inclusiveDays(range: DateRange): number {
  const from = parseDateKey(range.from)
  const to = parseDateKey(range.to)
  if (!from || !to) return Number.NaN
  return Math.round((to.getTime() - from.getTime()) / DAY_MS) + 1
}

/** Календарный месяц, в который попадает `dateKey`, сдвинутый на `monthOffset` месяцев. */
function monthRange(dateKey: string, monthOffset: number): DateRange {
  const base = requireDateKey(dateKey)
  const year = base.getUTCFullYear()
  const month = base.getUTCMonth() + monthOffset
  return {
    from: formatKey(new Date(Date.UTC(year, month, 1))),
    // День 0 следующего месяца — последний день текущего; високосный февраль учитывается самим Date.
    to: formatKey(new Date(Date.UTC(year, month + 1, 0))),
  }
}

/** Диапазон для быстрой кнопки. «7 дней» и «30 дней» включают сегодняшний день. */
export function presetRange(preset: PeriodPreset, now: Date): DateRange {
  const today = tashkentToday(now)
  switch (preset) {
    case 'last7':
      return { from: addDays(today, -6), to: today }
    case 'last30':
      return { from: addDays(today, -29), to: today }
    case 'thisMonth':
      return monthRange(today, 0)
    case 'lastMonth':
      return monthRange(today, -1)
  }
}

/** Текст ошибки для периода или null, если период можно отправить на сервер. */
export function validatePeriod(range: DateRange): string | null {
  if (!isDateKey(range.from) || !isDateKey(range.to)) return 'Укажите обе даты.'
  if (range.from > range.to) return 'Дата начала не может быть позже даты конца.'
  if (inclusiveDays(range) > MAX_PERIOD_DAYS) return 'Период не может быть длиннее 366 дней.'
  return null
}

/** Быстрая кнопка, совпадающая с периодом (для подсветки), либо null. */
export function matchPreset(range: DateRange, now: Date): PeriodPreset | null {
  for (const item of PERIOD_PRESETS) {
    const candidate = presetRange(item.value, now)
    if (candidate.from === range.from && candidate.to === range.to) return item.value
  }
  return null
}
