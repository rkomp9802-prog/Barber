import type { AdminScheduleInput, WeeklyRangeDto } from '@barber/shared'

/*
 * Недельный график барбера в форме: по дням недели — смены и обеды. Время 'HH:MM' по Ташкенту.
 * Проверки повторяют серверные (packages/shared/src/admin-api/catalog.ts): начало раньше конца,
 * смены дня не пересекаются, каждый обед внутри смены своего дня, обеды не пересекаются.
 */

export type TimeRange = { startTime: string; endTime: string }

export type DaySchedule = {
  weekday: number
  shifts: TimeRange[]
  breaks: TimeRange[]
}

export type ScheduleResult = { ok: true; value: AdminScheduleInput } | { ok: false; error: string }

/** Понедельник первым: так неделя читается в России и Узбекистане. */
export const WEEKDAY_ORDER: readonly number[] = [1, 2, 3, 4, 5, 6, 0]

export const WEEKDAY_NAMES: Readonly<Record<number, string>> = {
  0: 'Воскресенье',
  1: 'Понедельник',
  2: 'Вторник',
  3: 'Среда',
  4: 'Четверг',
  5: 'Пятница',
  6: 'Суббота',
}

const HHMM_PATTERN = /^(([01]\d|2[0-3]):[0-5]\d|24:00)$/
const MINUTES_IN_HOUR = 60
const END_OF_DAY = 24 * MINUTES_IN_HOUR

/** '09:30' → 570; '24:00' → 1440; неверный формат → null. */
export function timeToMinutes(value: string): number | null {
  if (!HHMM_PATTERN.test(value)) return null
  const [hours = 0, minutes = 0] = value.split(':').map(Number)
  return hours * MINUTES_IN_HOUR + minutes
}

/** Пустой график на все семь дней. */
export function emptySchedule(): DaySchedule[] {
  return WEEKDAY_ORDER.map(weekday => ({ weekday, shifts: [], breaks: [] }))
}

/** Превращает плоские списки из API в дни недели. */
export function scheduleToDays(schedule: { workingHours: readonly WeeklyRangeDto[]; breaks: readonly WeeklyRangeDto[] }): DaySchedule[] {
  const toRange = (item: WeeklyRangeDto): TimeRange => ({ startTime: item.startTime, endTime: item.endTime })
  const byStart = (a: TimeRange, b: TimeRange) => (timeToMinutes(a.startTime) ?? 0) - (timeToMinutes(b.startTime) ?? 0)
  return WEEKDAY_ORDER.map(weekday => ({
    weekday,
    shifts: schedule.workingHours.filter(item => item.weekday === weekday).map(toRange).sort(byStart),
    breaks: schedule.breaks.filter(item => item.weekday === weekday).map(toRange).sort(byStart),
  }))
}

function checkRange(range: TimeRange, dayName: string, kind: string): string | null {
  const start = timeToMinutes(range.startTime)
  const end = timeToMinutes(range.endTime)
  if (start === null || end === null) return `${dayName}: укажите время ${kind} в формате ЧЧ:ММ.`
  if (start >= end) return `${dayName}: начало ${kind} должно быть раньше конца.`
  if (end > END_OF_DAY) return `${dayName}: время ${kind} не может выходить за сутки.`
  return null
}

function overlaps(a: TimeRange, b: TimeRange): boolean {
  return (timeToMinutes(a.startTime) ?? 0) < (timeToMinutes(b.endTime) ?? 0) &&
    (timeToMinutes(b.startTime) ?? 0) < (timeToMinutes(a.endTime) ?? 0)
}

function isInside(inner: TimeRange, outer: TimeRange): boolean {
  return (timeToMinutes(outer.startTime) ?? 0) <= (timeToMinutes(inner.startTime) ?? 0) &&
    (timeToMinutes(inner.endTime) ?? 0) <= (timeToMinutes(outer.endTime) ?? 0)
}

/** Проверка одного дня; возвращает текст первой найденной ошибки или null. */
export function checkDay(day: DaySchedule): string | null {
  const name = WEEKDAY_NAMES[day.weekday] ?? 'День'
  for (const shift of day.shifts) {
    const error = checkRange(shift, name, 'смены')
    if (error) return error
  }
  for (const shift of day.shifts) {
    if (day.shifts.some(other => other !== shift && overlaps(shift, other))) {
      return `${name}: смены пересекаются.`
    }
  }
  for (const item of day.breaks) {
    const error = checkRange(item, name, 'обеда')
    if (error) return error
    if (!day.shifts.some(shift => isInside(item, shift))) {
      return `${name}: обед должен быть внутри одной из смен этого дня.`
    }
  }
  for (const item of day.breaks) {
    if (day.breaks.some(other => other !== item && overlaps(item, other))) {
      return `${name}: обеды пересекаются.`
    }
  }
  return null
}

/** Собирает входные данные PUT /schedule или возвращает первую ошибку по-русски. */
export function buildScheduleInput(days: readonly DaySchedule[]): ScheduleResult {
  for (const day of days) {
    const error = checkDay(day)
    if (error) return { ok: false, error }
  }
  const sorted = [...days].sort((a, b) => WEEKDAY_ORDER.indexOf(a.weekday) - WEEKDAY_ORDER.indexOf(b.weekday))
  const toDto = (weekday: number) => (range: TimeRange): WeeklyRangeDto => ({
    weekday,
    startTime: range.startTime,
    endTime: range.endTime,
  })
  return {
    ok: true,
    value: {
      workingHours: sorted.flatMap(day => day.shifts.map(toDto(day.weekday))),
      breaks: sorted.flatMap(day => day.breaks.map(toDto(day.weekday))),
    },
  }
}
