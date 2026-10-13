import type { BookingDto, BookingStatus } from '@barber/shared'
import { describe, expect, it } from 'vitest'

import { bookingDateKey, formatTashkentTime, isUpcoming, replaceBooking, sortBookings } from './bookings'
import { nextPhoneValue } from './phoneInput'

function booking(id: string, startsAt: string, status: BookingStatus = 'confirmed'): BookingDto {
  const endsAt = new Date(new Date(startsAt).getTime() + 30 * 60_000).toISOString()
  return { id, startsAt, endsAt, status } as BookingDto
}

const now = new Date('2026-10-11T10:00:00Z')

describe('bookings helpers', () => {
  it('formats time and date in Tashkent (UTC+5)', () => {
    expect(formatTashkentTime('2026-10-11T09:30:00Z')).toBe('14:30')
    expect(bookingDateKey('2026-10-11T20:00:00Z')).toBe('2026-10-12')
  })

  it('treats only confirmed future bookings as upcoming', () => {
    expect(isUpcoming(booking('a', '2026-10-12T05:00:00Z'), now)).toBe(true)
    expect(isUpcoming(booking('b', '2026-10-12T05:00:00Z', 'cancelled'), now)).toBe(false)
    expect(isUpcoming(booking('c', '2026-10-10T05:00:00Z'), now)).toBe(false)
  })

  it('sorts upcoming first (soonest first), then past (latest first)', () => {
    const list = [
      booking('past-old', '2026-10-01T05:00:00Z', 'completed'),
      booking('future-far', '2026-10-20T05:00:00Z'),
      booking('cancelled', '2026-10-15T05:00:00Z', 'cancelled'),
      booking('future-near', '2026-10-12T05:00:00Z'),
    ]
    expect(sortBookings(list, now).map(b => b.id)).toEqual(['future-near', 'future-far', 'cancelled', 'past-old'])
    expect(list[0]?.id).toBe('past-old')
  })

  it('replaces a booking without mutating the list', () => {
    const list = [booking('a', '2026-10-12T05:00:00Z'), booking('b', '2026-10-13T05:00:00Z')]
    const updated = { ...list[0], status: 'cancelled' } as BookingDto
    const result = replaceBooking(list, updated)
    expect(result[0]?.status).toBe('cancelled')
    expect(list[0]?.status).toBe('confirmed')
  })
})

describe('nextPhoneValue', () => {
  it('formats typed digits with the +998 mask', () => {
    expect(nextPhoneValue('+998 ', '+998 901234567')).toBe('+998 90 123 45 67')
  })

  it('removes a digit when only a mask space was deleted', () => {
    expect(nextPhoneValue('+998 90 123', '+998 90123')).toBe('+998 90 12')
  })

  it('clears the field when all digits are removed', () => {
    expect(nextPhoneValue('+998 9', '+998 ')).toBe('')
  })

  it('accepts a full international number pasted over the mask', () => {
    expect(nextPhoneValue('+998 ', '+998 +998901234567')).toBe('+998 90 123 45 67')
    expect(nextPhoneValue('', '998901234567')).toBe('+998 90 123 45 67')
  })

  it('keeps local numbers that start with 998', () => {
    expect(nextPhoneValue('+998 99', '+998 998')).toBe('+998 99 8')
  })
})
