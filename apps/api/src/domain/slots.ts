import type { SlotDto } from '@barber/shared'
import { containsRange, overlapsAny, subtractIntervals } from './intervals'
import type { Quote } from './pricing'
import type { BookingRules } from './settings'
import {
  MINUTE_MS,
  addDaysToKey,
  dateKeyInZone,
  parseHhmm,
  timeInZone,
  weekdayOfKey,
  zonedToUtc,
  type Interval,
} from './time'

/** Повторяющийся по дням недели промежуток ('HH:MM' по времени салона). */
export type WeeklyRange = { readonly weekday: number; readonly startTime: string; readonly endTime: string }

/** Всё, что нужно знать о барбере для расчёта слотов в заданном диапазоне дат. */
export type BarberCalendar = {
  readonly barberId: string
  readonly sortOrder: number
  readonly quote: Quote
  readonly workingHours: readonly WeeklyRange[]
  readonly breaks: readonly WeeklyRange[]
  /** time_off барбера и закрытия всего салона. */
  readonly timeOff: readonly Interval[]
  /** Подтверждённые записи барбера. */
  readonly bookings: readonly Interval[]
}

/** Причина, по которой нельзя начать запись в выбранный момент. */
export type SlotRejection = 'TOO_SOON' | 'TOO_FAR' | 'OUTSIDE_WORKING_HOURS' | 'SLOT_TAKEN'

function rangesOfDay(ranges: readonly WeeklyRange[], dateKey: string, timeZone: string): Interval[] {
  const weekday = weekdayOfKey(dateKey)
  return ranges
    .filter(range => range.weekday === weekday)
    .map(range => ({
      start: zonedToUtc(dateKey, parseHhmm(range.startTime), timeZone),
      end: zonedToUtc(dateKey, parseHhmm(range.endTime), timeZone),
    }))
}

/** Рабочее время дня за вычетом обедов и исключений (записи ещё не вычтены). */
export function workIntervalsForDay(calendar: BarberCalendar, dateKey: string, timeZone: string): Interval[] {
  const working = rangesOfDay(calendar.workingHours, dateKey, timeZone)
  const breaks = rangesOfDay(calendar.breaks, dateKey, timeZone)
  return subtractIntervals(working, [...breaks, ...calendar.timeOff])
}

/** Свободные интервалы дня: рабочее время минус обеды, исключения и подтверждённые записи. */
export function freeIntervalsForDay(calendar: BarberCalendar, dateKey: string, timeZone: string): Interval[] {
  return subtractIntervals(workIntervalsForDay(calendar, dateKey, timeZone), calendar.bookings)
}

/** Самая поздняя дата (по времени салона), на которую можно записаться. */
export function lastBookableDateKey(rules: BookingRules, now: number): string {
  return addDaysToKey(dateKeyInZone(now, rules.timezone), rules.horizonDays)
}

/** Самый ранний момент начала записи с учётом min_notice_min. */
export function earliestStart(rules: BookingRules, now: number): number {
  return now + rules.minNoticeMin * MINUTE_MS
}

/**
 * Старты слотов барбера за день. Сетка шагом slot_step_min от начала рабочей смены,
 * услуга должна поместиться целиком в свободный интервал.
 */
export function slotStartsForBarber(
  calendar: BarberCalendar,
  dateKey: string,
  rules: BookingRules,
  now: number,
): number[] {
  if (dateKey > lastBookableDateKey(rules, now)) return []
  const durationMs = calendar.quote.totalDurationMin * MINUTE_MS
  const stepMs = rules.slotStepMin * MINUTE_MS
  const minStart = earliestStart(rules, now)
  const free = freeIntervalsForDay(calendar, dateKey, rules.timezone)
  const shifts = rangesOfDay(calendar.workingHours, dateKey, rules.timezone)
  const starts = new Set<number>()
  for (const shift of shifts) {
    for (let start = shift.start; start + durationMs <= shift.end; start += stepMs) {
      if (start >= minStart && containsRange(free, start, start + durationMs)) starts.add(start)
    }
  }
  return [...starts].toSorted((a, b) => a - b)
}

/** Слоты дня по нескольким барберам: объединённый список, у каждого слота — свободные барберы. */
export function buildDaySlots(
  calendars: readonly BarberCalendar[],
  dateKey: string,
  rules: BookingRules,
  now: number,
): SlotDto[] {
  const byStart = new Map<number, string[]>()
  for (const calendar of calendars) {
    for (const start of slotStartsForBarber(calendar, dateKey, rules, now)) {
      byStart.set(start, [...(byStart.get(start) ?? []), calendar.barberId])
    }
  }
  return [...byStart.entries()]
    .toSorted(([a], [b]) => a - b)
    .map(([start, barberIds]) => ({
      startsAt: new Date(start).toISOString(),
      time: timeInZone(start, rules.timezone),
      barberIds,
    }))
}

/**
 * Проверяет, можно ли начать запись у барбера в момент start (мс UTC).
 * Порядок проверок: рано → далеко → нерабочее время → занято.
 */
export function checkStart(
  calendar: BarberCalendar,
  start: number,
  rules: BookingRules,
  now: number,
): SlotRejection | null {
  if (start < earliestStart(rules, now)) return 'TOO_SOON'
  const dateKey = dateKeyInZone(start, rules.timezone)
  if (dateKey > lastBookableDateKey(rules, now)) return 'TOO_FAR'
  const end = start + calendar.quote.totalDurationMin * MINUTE_MS
  const work = workIntervalsForDay(calendar, dateKey, rules.timezone)
  if (!containsRange(work, start, end)) return 'OUTSIDE_WORKING_HOURS'
  if (overlapsAny(calendar.bookings, start, end)) return 'SLOT_TAKEN'
  return null
}

/** Длительность для ответа /availability: у разных барберов может отличаться — берём минимальную. */
export function displayDurationMin(barbers: readonly { readonly quote: Quote }[]): number {
  const durations = barbers.map(barber => barber.quote.totalDurationMin)
  return durations.length === 0 ? 0 : Math.min(...durations)
}
