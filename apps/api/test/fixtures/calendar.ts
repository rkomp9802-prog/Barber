import type { Quote } from '../../src/domain/pricing'
import { DEFAULT_RULES, type BookingRules } from '../../src/domain/settings'
import type { BarberCalendar, WeeklyRange } from '../../src/domain/slots'
import type { Interval } from '../../src/domain/time'

/** Понедельник 12.10.2026. Ташкент = UTC+5: 10:00 по Ташкенту = 05:00Z. */
export const MONDAY = '2026-10-12'
export const SUNDAY = '2026-10-18'

/** Момент по Ташкенту: tashkent('2026-10-12', '10:00') → мс UTC. */
export function tashkent(dateKey: string, hhmm: string): number {
  return Date.parse(`${dateKey}T${hhmm}:00+05:00`)
}

export function interval(dateKey: string, from: string, to: string): Interval {
  return { start: tashkent(dateKey, from), end: tashkent(dateKey, to) }
}

const MON_SAT = [1, 2, 3, 4, 5, 6]

export const STANDARD_HOURS: WeeklyRange[] = [
  ...MON_SAT.map(weekday => ({ weekday, startTime: '10:00', endTime: '21:00' })),
  { weekday: 0, startTime: '11:00', endTime: '19:00' },
]

export const LUNCH: WeeklyRange[] = [0, ...MON_SAT].map(weekday => ({ weekday, startTime: '14:00', endTime: '15:00' }))

export function quote(durationMin: number, barberId = 'b1', price = 100_000): Quote {
  return {
    barberId,
    totalDurationMin: durationMin,
    totalPrice: price,
    items: [{ serviceId: 's1', name: 'Стрижка', durationMin, price }],
  }
}

export function calendar(overrides: Partial<BarberCalendar> = {}): BarberCalendar {
  const barberId = overrides.barberId ?? 'b1'
  return {
    barberId,
    sortOrder: 0,
    quote: quote(60, barberId),
    workingHours: STANDARD_HOURS,
    breaks: LUNCH,
    timeOff: [],
    bookings: [],
    ...overrides,
  }
}

/** Правила для тестов: «сейчас» далеко до тестового дня, поэтому notice/horizon не мешают. */
export function rules(overrides: Partial<BookingRules> = {}): BookingRules {
  return { ...DEFAULT_RULES, ...overrides }
}

/** «Сейчас» — воскресенье 11.10.2026 12:00 по Ташкенту. */
export const NOW = tashkent('2026-10-11', '12:00')

export function times(starts: readonly number[]): string[] {
  return starts.map(start => new Date(start + 5 * 3_600_000).toISOString().slice(11, 16))
}
