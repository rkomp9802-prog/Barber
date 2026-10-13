import { describe, expect, it } from 'vitest'
import { canChangeBooking, changeRejection, loadMinutesOnDay, rankFreeBarbers } from '../../src/domain/booking-rules'
import { MONDAY, NOW, calendar, interval, rules, tashkent } from '../fixtures/calendar'

const R = rules({ cancelCutoffMin: 30 })

describe('cutoff отмены и переноса', () => {
  const start = tashkent(MONDAY, '12:00')

  it('можно менять раньше чем за cancel_cutoff_min', () => {
    expect(changeRejection('confirmed', start, R, tashkent(MONDAY, '11:29'))).toBeNull()
    expect(canChangeBooking('confirmed', start, R, tashkent(MONDAY, '11:29'))).toBe(true)
  })

  it('ровно за 30 минут и позже — CUTOFF_PASSED', () => {
    expect(changeRejection('confirmed', start, R, tashkent(MONDAY, '11:30'))).toBe('CUTOFF_PASSED')
    expect(changeRejection('confirmed', start, R, tashkent(MONDAY, '12:10'))).toBe('CUTOFF_PASSED')
  })

  it('отменённую или завершённую запись менять нельзя', () => {
    expect(changeRejection('cancelled', start, R, NOW)).toBe('BOOKING_NOT_ACTIVE')
    expect(changeRejection('completed', start, R, NOW)).toBe('BOOKING_NOT_ACTIVE')
    expect(canChangeBooking('no_show', start, R, NOW)).toBe(false)
  })

  it('учитывает настройку cutoff', () => {
    const strict = rules({ cancelCutoffMin: 120 })
    expect(changeRejection('confirmed', start, strict, tashkent(MONDAY, '10:30'))).toBe('CUTOFF_PASSED')
  })
})

describe('loadMinutesOnDay', () => {
  it('считает только записи этого дня', () => {
    const bookings = [interval(MONDAY, '10:00', '11:00'), interval(MONDAY, '12:00', '12:30'), interval('2026-10-13', '10:00', '11:00')]
    expect(loadMinutesOnDay(bookings, tashkent(MONDAY, '15:00'), 'Asia/Tashkent')).toBe(90)
  })
})

describe('rankFreeBarbers («любой свободный»)', () => {
  const start = tashkent(MONDAY, '16:00')

  it('выбирает наименее загруженного барбера', () => {
    const busy = calendar({ barberId: 'busy', bookings: [interval(MONDAY, '10:00', '12:00')] })
    const light = calendar({ barberId: 'light', bookings: [interval(MONDAY, '10:00', '11:00')] })
    const result = rankFreeBarbers([busy, light], start, R, NOW)
    expect(result.ok && result.candidates.map(c => c.barberId)).toEqual(['light', 'busy'])
  })

  it('при равной загрузке — по sort_order, затем по id (детерминированно)', () => {
    const z = calendar({ barberId: 'z', sortOrder: 1 })
    const y = calendar({ barberId: 'y', sortOrder: 1 })
    const first = calendar({ barberId: 'x', sortOrder: 0 })
    const result = rankFreeBarbers([z, y, first], start, R, NOW)
    expect(result.ok && result.candidates.map(c => c.barberId)).toEqual(['x', 'y', 'z'])
  })

  it('пропускает барберов, занятых в это время', () => {
    const taken = calendar({ barberId: 'taken', bookings: [interval(MONDAY, '16:00', '17:00')] })
    const free = calendar({ barberId: 'free', bookings: [interval(MONDAY, '10:00', '13:00')] })
    const result = rankFreeBarbers([taken, free], start, R, NOW)
    expect(result.ok && result.candidates.map(c => c.barberId)).toEqual(['free'])
  })

  it('если все заняты — SLOT_TAKEN, если никто не работает — OUTSIDE_WORKING_HOURS', () => {
    const taken = calendar({ barberId: 'a', bookings: [interval(MONDAY, '16:00', '17:00')] })
    const off = calendar({ barberId: 'b', timeOff: [interval(MONDAY, '10:00', '21:00')] })
    expect(rankFreeBarbers([taken, off], start, R, NOW)).toEqual({ ok: false, reason: 'SLOT_TAKEN' })
    expect(rankFreeBarbers([off], start, R, NOW)).toEqual({ ok: false, reason: 'OUTSIDE_WORKING_HOURS' })
  })

  it('слишком рано — TOO_SOON у всех', () => {
    expect(rankFreeBarbers([calendar()], NOW + 60_000, R, NOW)).toEqual({ ok: false, reason: 'TOO_SOON' })
  })
})
