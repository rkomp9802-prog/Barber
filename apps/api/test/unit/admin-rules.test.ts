import { describe, expect, it } from 'vitest'
import { validateSchedule } from '../../src/admin/domain/schedule-rules'
import { manualRejection, statusRejection } from '../../src/admin/domain/booking-rules'
import { timeOffProblem } from '../../src/admin/domain/time-off-rules'
import { calendar, MONDAY, tashkent } from '../fixtures/calendar'

const TZ = 'Asia/Tashkent'
const shift = (weekday: number, startTime: string, endTime: string) => ({ weekday, startTime, endTime })

describe('validateSchedule', () => {
  it('корректный график без замечаний', () => {
    const issues = validateSchedule({
      workingHours: [shift(1, '10:00', '21:00'), shift(2, '10:00', '21:00')],
      breaks: [shift(1, '14:00', '15:00')],
    })
    expect(issues).toEqual([])
  })

  it('конец смены раньше начала или равен ему — ошибка на этой строке', () => {
    const issues = validateSchedule({ workingHours: [shift(1, '21:00', '21:00')], breaks: [] })
    expect(issues).toEqual([{ path: 'workingHours.0', message: 'Начало должно быть раньше конца' }])
  })

  it('смены одного дня не пересекаются, но разных дней — можно', () => {
    const overlapping = validateSchedule({ workingHours: [shift(3, '10:00', '14:00'), shift(3, '12:00', '18:00')], breaks: [] })
    expect(overlapping.map(issue => issue.path)).toEqual(['workingHours.1'])
    const otherDay = validateSchedule({ workingHours: [shift(3, '10:00', '14:00'), shift(4, '12:00', '18:00')], breaks: [] })
    expect(otherDay).toEqual([])
  })

  it('обед должен лежать внутри смены своего дня', () => {
    const issues = validateSchedule({ workingHours: [shift(5, '10:00', '14:00')], breaks: [shift(6, '11:00', '12:00')] })
    expect(issues).toEqual([{ path: 'breaks.0', message: 'Обед должен лежать внутри рабочей смены этого дня' }])
  })

  it('обед, выходящий за край смены, — ошибка', () => {
    const issues = validateSchedule({ workingHours: [shift(5, '10:00', '14:00')], breaks: [shift(5, '13:30', '14:30')] })
    expect(issues.map(issue => issue.path)).toEqual(['breaks.0'])
  })

  it('24:00 допустимо только как конец дня', () => {
    expect(validateSchedule({ workingHours: [shift(0, '10:00', '24:00')], breaks: [] })).toEqual([])
    expect(validateSchedule({ workingHours: [shift(0, '24:00', '24:00')], breaks: [] })).toHaveLength(1)
  })
})

describe('manualRejection', () => {
  const now = tashkent(MONDAY, '09:00')
  const cal = calendar({ bookings: [{ start: tashkent(MONDAY, '12:00'), end: tashkent(MONDAY, '13:00') }] })
  const at = (hhmm: string, minutes: number) => {
    const start = tashkent(MONDAY, hhmm)
    return { start, end: start + minutes * 60_000 }
  }

  it('свободное время в рабочих часах — допустимо', () => {
    expect(manualRejection(cal, at('10:00', 60), TZ, now, false)).toBeNull()
  })

  it('пересечение с записью — SLOT_TAKEN даже с force', () => {
    expect(manualRejection(cal, at('12:30', 60), TZ, now, true)).toBe('SLOT_TAKEN')
  })

  it('вне часов без force — OUTSIDE_WORKING_HOURS; с force — допустимо', () => {
    expect(manualRejection(cal, at('14:30', 30), TZ, now, false)).toBe('OUTSIDE_WORKING_HOURS')
    expect(manualRejection(cal, at('14:30', 30), TZ, now, true)).toBeNull()
  })

  it('прошлый день — PAST; дальше 365 дней — TOO_FAR', () => {
    expect(manualRejection(cal, { start: tashkent('2026-10-11', '12:00'), end: tashkent('2026-10-11', '13:00') }, TZ, now, true)).toBe('PAST')
    expect(manualRejection(cal, { start: tashkent('2027-10-13', '12:00'), end: tashkent('2027-10-13', '13:00') }, TZ, now, true)).toBe('TOO_FAR')
  })
})

describe('statusRejection', () => {
  const startsAt = tashkent(MONDAY, '12:00')
  it('только из confirmed', () => {
    expect(statusRejection('cancelled', 'completed', startsAt, startsAt + 1)).toBe('BOOKING_NOT_ACTIVE')
  })
  it('completed и no_show — только после начала, отмена — всегда', () => {
    expect(statusRejection('confirmed', 'no_show', startsAt, startsAt - 1)).toBe('NOT_STARTED')
    expect(statusRejection('confirmed', 'completed', startsAt, startsAt + 1)).toBeNull()
    expect(statusRejection('confirmed', 'cancelled', startsAt, startsAt - 1)).toBeNull()
  })
})

describe('timeOffProblem', () => {
  const start = new Date(tashkent(MONDAY, '10:00'))
  const end = new Date(tashkent(MONDAY, '12:00'))
  it('начало раньше конца, shop_closed только с barberId = null', () => {
    expect(timeOffProblem({ barberId: 'b', startsAt: start, endsAt: end, type: 'vacation' })).toBeNull()
    expect(timeOffProblem({ barberId: 'b', startsAt: end, endsAt: start, type: 'vacation' })).not.toBeNull()
    expect(timeOffProblem({ barberId: 'b', startsAt: start, endsAt: end, type: 'shop_closed' })).not.toBeNull()
    expect(timeOffProblem({ barberId: null, startsAt: start, endsAt: end, type: 'shop_closed' })).toBeNull()
  })
})
