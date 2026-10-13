import type { BookingStatus } from '@barber/shared'
import { containsRange, overlapsAny } from '../../domain/intervals'
import type { BarberCalendar } from '../../domain/slots'
import { workIntervalsForDay } from '../../domain/slots'
import { addDaysToKey, dateKeyInZone, dayBoundsUtc, type Interval } from '../../domain/time'

/** Ручная запись можно не дальше этого числа дней от сегодня (контракт admin-api, operations.ts). */
export const MANUAL_BOOKING_MAX_DAYS = 365

export type ManualRejection = 'PAST' | 'TOO_FAR' | 'SLOT_TAKEN' | 'OUTSIDE_WORKING_HOURS'

/**
 * Проверка ручной записи и переноса. В отличие от записи клиента: нет min_notice_min и горизонта
 * бронирования (кроме 365 дней), нельзя записать в прошлое. Пересечение с другой записью — всегда отказ;
 * нерабочее время, обед и исключения — отказ, если не force.
 */
export function manualRejection(
  calendar: BarberCalendar,
  window: Interval,
  timeZone: string,
  now: number,
  force: boolean,
): ManualRejection | null {
  const today = dateKeyInZone(now, timeZone)
  if (window.start < dayBoundsUtc(today, timeZone).start) return 'PAST'
  const dateKey = dateKeyInZone(window.start, timeZone)
  if (dateKey > addDaysToKey(today, MANUAL_BOOKING_MAX_DAYS)) return 'TOO_FAR'
  if (overlapsAny(calendar.bookings, window.start, window.end)) return 'SLOT_TAKEN'
  if (force) return null
  const working = workIntervalsForDay(calendar, dateKey, timeZone)
  return containsRange(working, window.start, window.end) ? null : 'OUTSIDE_WORKING_HOURS'
}

/** Целевые статусы, которые администратор ставит вручную. */
export type AdminStatusTarget = 'completed' | 'cancelled' | 'no_show'

export type StatusRejection = 'BOOKING_NOT_ACTIVE' | 'NOT_STARTED'

/**
 * Переходы статуса: только из confirmed. completed и no_show — не раньше начала записи.
 * cancel_cutoff_min для администратора не действует.
 */
export function statusRejection(
  current: BookingStatus,
  target: AdminStatusTarget,
  startsAt: number,
  now: number,
): StatusRejection | null {
  if (current !== 'confirmed') return 'BOOKING_NOT_ACTIVE'
  if (target !== 'cancelled' && now < startsAt) return 'NOT_STARTED'
  return null
}
