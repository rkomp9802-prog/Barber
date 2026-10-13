import type {
  AvailabilityDaysQuery,
  AvailabilityDaysResponse,
  AvailabilityQuery,
  AvailabilityResponse,
} from '@barber/shared'
import { buildDaySlots, displayDurationMin, lastBookableDateKey } from '../domain/slots'
import { addDaysToKey, dateKeyInZone, dayBoundsUtc, isValidDateKey } from '../domain/time'
import { AppError } from '../errors'
import { loadCalendars, quoteBarbers } from './calendars'
import { loadRules, type ServiceContext } from './context'

function assertDate(dateKey: string): void {
  if (!isValidDateKey(dateKey)) throw new AppError('VALIDATION_ERROR', 'Такой даты не существует')
}

/** GET /availability — свободные слоты на один день. */
export async function getAvailability(ctx: ServiceContext, query: AvailabilityQuery): Promise<AvailabilityResponse> {
  assertDate(query.date)
  const now = ctx.now()
  const rules = await loadRules(ctx)
  const quoted = await quoteBarbers(ctx.repos, query.serviceIds, query.barberId)
  const today = dateKeyInZone(now, rules.timezone)
  const outOfWindow = query.date < today || query.date > lastBookableDateKey(rules, now)
  const calendars = outOfWindow
    ? []
    : await loadCalendars(ctx.repos, quoted, dayBoundsUtc(query.date, rules.timezone))
  return {
    date: query.date,
    durationMin: displayDurationMin(quoted),
    slots: buildDaySlots(calendars, query.date, rules, now),
  }
}

/** GET /availability/days — есть ли слоты в каждый из дней диапазона (для календаря). */
export async function getAvailabilityDays(
  ctx: ServiceContext,
  query: AvailabilityDaysQuery,
): Promise<AvailabilityDaysResponse> {
  assertDate(query.from)
  const now = ctx.now()
  const rules = await loadRules(ctx)
  const quoted = await quoteBarbers(ctx.repos, query.serviceIds, query.barberId)
  const keys = Array.from({ length: query.days }, (_, i) => addDaysToKey(query.from, i))
  const lastKey = keys.at(-1) ?? query.from
  const range = { start: dayBoundsUtc(query.from, rules.timezone).start, end: dayBoundsUtc(lastKey, rules.timezone).end }
  const calendars = await loadCalendars(ctx.repos, quoted, range)
  return {
    days: keys.map(date => ({ date, hasSlots: buildDaySlots(calendars, date, rules, now).length > 0 })),
  }
}
