import type { BookingStatus } from '@barber/shared'
import { checkStart, type BarberCalendar, type SlotRejection } from './slots'
import type { BookingRules } from './settings'
import { MINUTE_MS, dateKeyInZone, dayBoundsUtc, type Interval } from './time'

/** Почему нельзя отменить или перенести запись. */
export type ChangeRejection = 'BOOKING_NOT_ACTIVE' | 'CUTOFF_PASSED'

/**
 * Отмена и перенос разрешены, только пока запись подтверждена
 * и до начала больше cancel_cutoff_min минут.
 */
export function changeRejection(
  status: BookingStatus,
  startsAt: number,
  rules: BookingRules,
  now: number,
): ChangeRejection | null {
  if (status !== 'confirmed') return 'BOOKING_NOT_ACTIVE'
  if (now >= startsAt - rules.cancelCutoffMin * MINUTE_MS) return 'CUTOFF_PASSED'
  return null
}

export function canChangeBooking(status: BookingStatus, startsAt: number, rules: BookingRules, now: number): boolean {
  return changeRejection(status, startsAt, rules, now) === null
}

/** Сколько минут барбер уже занят в местный день, на который приходится start. */
export function loadMinutesOnDay(bookings: readonly Interval[], start: number, timeZone: string): number {
  const day = dayBoundsUtc(dateKeyInZone(start, timeZone), timeZone)
  return bookings
    .filter(booking => booking.start < day.end && day.start < booking.end)
    .reduce((sum, booking) => sum + (booking.end - booking.start) / MINUTE_MS, 0)
}

/** Результат выбора барбера на конкретное время. */
export type BarberChoiceResult =
  | { readonly ok: true; readonly candidates: readonly BarberCalendar[] }
  | { readonly ok: false; readonly reason: SlotRejection }

/**
 * Для режима «Любой свободный»: все барберы, свободные в start, по возрастанию
 * загрузки за день, затем по sort_order и id (детерминированно).
 * Первый кандидат — основной выбор, остальные — запасные на случай гонки.
 */
export function rankFreeBarbers(
  calendars: readonly BarberCalendar[],
  start: number,
  rules: BookingRules,
  now: number,
): BarberChoiceResult {
  const checks = calendars.map(calendar => ({ calendar, reason: checkStart(calendar, start, rules, now) }))
  const free = checks.filter(check => check.reason === null).map(check => check.calendar)
  if (free.length > 0) {
    const load = (calendar: BarberCalendar): number => loadMinutesOnDay(calendar.bookings, start, rules.timezone)
    const candidates = free.toSorted(
      (a, b) => load(a) - load(b) || a.sortOrder - b.sortOrder || a.barberId.localeCompare(b.barberId),
    )
    return { ok: true, candidates }
  }
  return { ok: false, reason: worstReason(checks.map(check => check.reason)) }
}

const REASON_PRIORITY: readonly SlotRejection[] = ['TOO_SOON', 'TOO_FAR', 'SLOT_TAKEN', 'OUTSIDE_WORKING_HOURS']

/** Для «любого»: если хоть у кого-то время просто занято — сообщаем SLOT_TAKEN. */
function worstReason(reasons: readonly (SlotRejection | null)[]): SlotRejection {
  return REASON_PRIORITY.find(reason => reasons.includes(reason)) ?? 'OUTSIDE_WORKING_HOURS'
}
