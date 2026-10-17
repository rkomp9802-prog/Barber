import { describe, expect, it } from 'vitest'

import type { BookingDto, BookingStatus } from '@barber/shared'

import {
  formatCountdown,
  holdRemainingMs,
  BOOKING_STATUS_LABELS,
  bookingClock,
  bookingCode,
  bookingDateKey,
  canShowActions,
  isActiveBooking,
  needsPhoneCall,
  statusTone,
} from './manageRules'

function bookingWith(status: BookingStatus, canChange: boolean): Pick<BookingDto, 'status' | 'canChange'> {
  return { status, canChange }
}

describe('canShowActions', () => {
  it('shows actions for an active booking that can still change', () => {
    expect(canShowActions(bookingWith('confirmed', true))).toBe(true)
  })

  it('hides actions for an active booking past the cutoff', () => {
    expect(canShowActions(bookingWith('confirmed', false))).toBe(false)
  })

  it('hides actions for a cancelled, completed or no-show booking even if canChange is true', () => {
    expect(canShowActions(bookingWith('cancelled', true))).toBe(false)
    expect(canShowActions(bookingWith('completed', true))).toBe(false)
    expect(canShowActions(bookingWith('no_show', true))).toBe(false)
  })
})

describe('needsPhoneCall', () => {
  it('asks to call only when the booking is active but can no longer change online', () => {
    expect(needsPhoneCall(bookingWith('confirmed', false))).toBe(true)
    expect(needsPhoneCall(bookingWith('confirmed', true))).toBe(false)
    expect(needsPhoneCall(bookingWith('cancelled', false))).toBe(false)
  })
})

describe('isActiveBooking', () => {
  it('treats only confirmed bookings as active', () => {
    expect(isActiveBooking({ status: 'confirmed' })).toBe(true)
    expect(isActiveBooking({ status: 'completed' })).toBe(false)
  })
})

describe('status presentation', () => {
  it('has a Russian label for every status', () => {
    expect(BOOKING_STATUS_LABELS).toEqual({
      pending: 'Ждёт подтверждения в Telegram',
      confirmed: 'Подтверждена',
      completed: 'Завершена',
      cancelled: 'Отменена',
      no_show: 'Клиент не пришёл',
    })
  })

  it('countdown to the end of the hold', () => {
    const hold = '2026-10-20T10:10:00.000Z'
    const at = (iso: string) => Date.parse(iso)
    expect(formatCountdown(holdRemainingMs(hold, at('2026-10-20T10:00:00.000Z')))).toBe('10:00')
    expect(formatCountdown(holdRemainingMs(hold, at('2026-10-20T10:09:55.500Z')))).toBe('0:05')
    expect(holdRemainingMs(hold, at('2026-10-20T10:11:00.000Z'))).toBe(0)
    expect(holdRemainingMs(null, 0)).toBe(0)
  })

  it('maps statuses to tones', () => {
    expect(statusTone('confirmed')).toBe('active')
    expect(statusTone('completed')).toBe('done')
    expect(statusTone('cancelled')).toBe('closed')
    expect(statusTone('no_show')).toBe('closed')
  })
})

describe('Tashkent date and time', () => {
  it('uses the Tashkent calendar day, not the UTC one', () => {
    // 20:30 UTC = 01:30 следующего дня в Ташкенте
    expect(bookingDateKey('2026-10-12T20:30:00.000Z')).toBe('2026-10-13')
    expect(bookingClock('2026-10-12T20:30:00.000Z')).toBe('01:30')
  })
})

describe('bookingCode', () => {
  it('takes the first eight characters of the id in upper case', () => {
    expect(bookingCode('3f2a9c1e-0000-4000-8000-000000000000')).toBe('3F2A9C1E')
  })
})
