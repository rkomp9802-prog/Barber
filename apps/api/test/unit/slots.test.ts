import { describe, expect, it } from 'vitest'
import {
  buildDaySlots,
  checkStart,
  displayDurationMin,
  freeIntervalsForDay,
  slotStartsForBarber,
} from '../../src/domain/slots'
import { MONDAY, NOW, SUNDAY, calendar, interval, quote, rules, tashkent, times } from '../fixtures/calendar'

const R = rules()

describe('slotStartsForBarber', () => {
  it('часовая услуга: шаг 15 минут, обед 14–15 исключён, последний старт 20:00', () => {
    const slots = times(slotStartsForBarber(calendar(), MONDAY, R, NOW))
    expect(slots[0]).toBe('10:00')
    expect(slots).toContain('13:00')
    expect(slots).not.toContain('13:15') // 13:15–14:15 задевает обед
    expect(slots).not.toContain('14:00')
    expect(slots).toContain('15:00')
    expect(slots.at(-1)).toBe('20:00') // 20:00–21:00 — ровно до конца дня
    expect(slots).not.toContain('20:15')
  })

  it('услуга должна поместиться до конца рабочего дня', () => {
    const slots = times(slotStartsForBarber(calendar({ quote: quote(90) }), MONDAY, R, NOW))
    expect(slots.at(-1)).toBe('19:30')
    expect(slots).toContain('12:30') // 12:30–14:00 — впритык к обеду
    expect(slots).not.toContain('12:45')
  })

  it('разная длительность даёт разное число слотов', () => {
    const short = slotStartsForBarber(calendar({ quote: quote(30) }), MONDAY, R, NOW)
    const long = slotStartsForBarber(calendar({ quote: quote(120) }), MONDAY, R, NOW)
    expect(short.length).toBeGreaterThan(long.length)
  })

  it('учитывает шаг slot_step_min', () => {
    const slots = times(slotStartsForBarber(calendar(), MONDAY, rules({ slotStepMin: 30 }), NOW))
    expect(slots.slice(0, 3)).toEqual(['10:00', '10:30', '11:00'])
  })

  it('существующая запись занимает время', () => {
    const cal = calendar({ bookings: [interval(MONDAY, '11:00', '12:00')] })
    const slots = times(slotStartsForBarber(cal, MONDAY, R, NOW))
    expect(slots).toContain('10:00') // 10:00–11:00 — встык
    expect(slots).not.toContain('10:15')
    expect(slots).not.toContain('11:00')
    expect(slots).toContain('12:00')
  })

  it('time_off на часть дня и на весь день', () => {
    const partial = calendar({ timeOff: [interval(MONDAY, '16:00', '18:00')] })
    const slots = times(slotStartsForBarber(partial, MONDAY, R, NOW))
    expect(slots).toContain('15:00')
    expect(slots).not.toContain('15:15')
    expect(slots).toContain('18:00')
    const wholeDay = calendar({ timeOff: [{ start: tashkent(MONDAY, '00:00'), end: tashkent('2026-10-13', '00:00') }] })
    expect(slotStartsForBarber(wholeDay, MONDAY, R, NOW)).toEqual([])
  })

  it('выходной день недели — слотов нет', () => {
    const noSunday = calendar({ workingHours: calendar().workingHours.filter(range => range.weekday !== 0) })
    expect(slotStartsForBarber(noSunday, SUNDAY, R, NOW)).toEqual([])
    expect(times(slotStartsForBarber(calendar(), SUNDAY, R, NOW))[0]).toBe('11:00')
  })

  it('прошедшее время и min_notice_min исключаются', () => {
    const now = tashkent(MONDAY, '12:05')
    const slots = times(slotStartsForBarber(calendar(), MONDAY, rules({ minNoticeMin: 30 }), now))
    expect(slots[0]).toBe('12:45') // раньше 12:35 нельзя, ближайший шаг сетки — 12:45
  })

  it('booking_horizon_days ограничивает дальние даты', () => {
    const r = rules({ horizonDays: 7 })
    expect(slotStartsForBarber(calendar(), '2026-10-18', r, NOW).length).toBeGreaterThan(0)
    expect(slotStartsForBarber(calendar(), '2026-10-19', r, NOW)).toEqual([])
  })
})

describe('freeIntervalsForDay', () => {
  it('рабочий день минус обед и записи', () => {
    const cal = calendar({ bookings: [interval(MONDAY, '10:00', '11:00')] })
    const free = freeIntervalsForDay(cal, MONDAY, R.timezone)
    expect(free).toEqual([interval(MONDAY, '11:00', '14:00'), interval(MONDAY, '15:00', '21:00')])
  })
})

describe('buildDaySlots (режим «любой барбер»)', () => {
  it('объединяет слоты и перечисляет свободных барберов', () => {
    const a = calendar({ barberId: 'a', bookings: [interval(MONDAY, '10:00', '11:00')] })
    const b = calendar({ barberId: 'b', quote: quote(60, 'b') })
    const slots = buildDaySlots([a, b], MONDAY, R, NOW)
    const ten = slots.find(slot => slot.time === '10:00')
    const eleven = slots.find(slot => slot.time === '11:00')
    expect(ten?.barberIds).toEqual(['b'])
    expect(eleven?.barberIds).toEqual(['a', 'b'])
    expect(ten?.startsAt).toBe('2026-10-12T05:00:00.000Z')
  })

  it('слоты отсортированы и без дублей', () => {
    const slots = buildDaySlots([calendar({ barberId: 'a' }), calendar({ barberId: 'b' })], MONDAY, R, NOW)
    const starts = slots.map(slot => slot.startsAt)
    expect(new Set(starts).size).toBe(starts.length)
    expect(starts).toEqual([...starts].sort())
  })

  it('displayDurationMin — минимальная длительность среди барберов', () => {
    expect(displayDurationMin([{ quote: quote(60) }, { quote: quote(45) }])).toBe(45)
    expect(displayDurationMin([])).toBe(0)
  })
})

describe('checkStart', () => {
  const cal = calendar({ bookings: [interval(MONDAY, '16:00', '17:00')] })

  it('свободное время — null', () => {
    expect(checkStart(cal, tashkent(MONDAY, '10:00'), R, NOW)).toBeNull()
  })

  it('время не на сетке, но внутри рабочего времени, тоже допустимо', () => {
    expect(checkStart(cal, tashkent(MONDAY, '10:10'), R, NOW)).toBeNull()
  })

  it('TOO_SOON для прошлого и ближе min_notice_min', () => {
    expect(checkStart(cal, NOW - 60_000, R, NOW)).toBe('TOO_SOON')
    expect(checkStart(cal, NOW + 10 * 60_000, R, NOW)).toBe('TOO_SOON')
  })

  it('TOO_FAR за горизонтом записи', () => {
    expect(checkStart(cal, tashkent('2026-11-11', '12:00'), rules({ horizonDays: 30 }), NOW)).toBe('TOO_FAR')
  })

  it('OUTSIDE_WORKING_HOURS: до открытия, обед, конец дня, time_off', () => {
    expect(checkStart(cal, tashkent(MONDAY, '09:00'), R, NOW)).toBe('OUTSIDE_WORKING_HOURS')
    expect(checkStart(cal, tashkent(MONDAY, '13:30'), R, NOW)).toBe('OUTSIDE_WORKING_HOURS')
    expect(checkStart(cal, tashkent(MONDAY, '20:30'), R, NOW)).toBe('OUTSIDE_WORKING_HOURS')
    const off = calendar({ timeOff: [interval(MONDAY, '10:00', '12:00')] })
    expect(checkStart(off, tashkent(MONDAY, '11:00'), R, NOW)).toBe('OUTSIDE_WORKING_HOURS')
  })

  it('SLOT_TAKEN при пересечении с записью', () => {
    expect(checkStart(cal, tashkent(MONDAY, '15:30'), R, NOW)).toBe('SLOT_TAKEN')
    expect(checkStart(cal, tashkent(MONDAY, '17:00'), R, NOW)).toBeNull()
  })
})
