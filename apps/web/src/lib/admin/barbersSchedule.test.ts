import { describe, expect, it } from 'vitest'

import { buildScheduleInput, checkDay, emptySchedule, scheduleToDays, timeToMinutes, type DaySchedule } from './barbersSchedule'

function day(weekday: number, shifts: [string, string][], breaks: [string, string][] = []): DaySchedule {
  return {
    weekday,
    shifts: shifts.map(([startTime, endTime]) => ({ startTime, endTime })),
    breaks: breaks.map(([startTime, endTime]) => ({ startTime, endTime })),
  }
}

describe('timeToMinutes', () => {
  it('parses HH:MM and accepts 24:00 as the end of day', () => {
    expect(timeToMinutes('09:30')).toBe(570)
    expect(timeToMinutes('24:00')).toBe(1440)
  })

  it('rejects malformed values', () => {
    expect(timeToMinutes('9:30')).toBeNull()
    expect(timeToMinutes('25:00')).toBeNull()
    expect(timeToMinutes('')).toBeNull()
  })
})

describe('checkDay', () => {
  it('accepts a shift with a lunch break inside it', () => {
    expect(checkDay(day(1, [['10:00', '20:00']], [['14:00', '15:00']]))).toBeNull()
  })

  it('rejects a shift that starts after it ends', () => {
    expect(checkDay(day(1, [['20:00', '10:00']]))).toMatch(/раньше конца/)
  })

  it('rejects an empty shift', () => {
    expect(checkDay(day(1, [['10:00', '10:00']]))).toMatch(/раньше конца/)
  })

  it('rejects overlapping shifts of the same day', () => {
    expect(checkDay(day(2, [['10:00', '14:00'], ['13:00', '18:00']]))).toMatch(/смены пересекаются/)
  })

  it('rejects a break outside every shift', () => {
    expect(checkDay(day(3, [['10:00', '14:00']], [['13:30', '14:30']]))).toMatch(/внутри одной из смен/)
  })

  it('rejects overlapping breaks', () => {
    expect(checkDay(day(3, [['10:00', '20:00']], [['13:00', '14:00'], ['13:30', '14:30']]))).toMatch(/обеды пересекаются/)
  })

  it('names the weekday in the message', () => {
    expect(checkDay(day(6, [['20:00', '10:00']]))).toMatch(/^Суббота:/)
  })
})

describe('buildScheduleInput', () => {
  it('flattens days into API lists with weekday numbers', () => {
    const days = emptySchedule()
    days[0] = day(1, [['10:00', '19:00']], [['13:00', '14:00']])
    const result = buildScheduleInput(days)
    expect(result).toEqual({
      ok: true,
      value: {
        workingHours: [{ weekday: 1, startTime: '10:00', endTime: '19:00' }],
        breaks: [{ weekday: 1, startTime: '13:00', endTime: '14:00' }],
      },
    })
  })

  it('returns the first error instead of input when a day is invalid', () => {
    const days = emptySchedule()
    days[1] = day(2, [['19:00', '10:00']])
    const result = buildScheduleInput(days)
    expect(result.ok).toBe(false)
  })
})

describe('scheduleToDays', () => {
  it('groups API ranges by weekday in Monday-first order and sorts them by start', () => {
    const days = scheduleToDays({
      workingHours: [
        { weekday: 0, startTime: '10:00', endTime: '18:00' },
        { weekday: 1, startTime: '14:00', endTime: '20:00' },
        { weekday: 1, startTime: '09:00', endTime: '12:00' },
      ],
      breaks: [{ weekday: 1, startTime: '15:00', endTime: '16:00' }],
    })
    expect(days.map(item => item.weekday)).toEqual([1, 2, 3, 4, 5, 6, 0])
    expect(days[0]?.shifts.map(shift => shift.startTime)).toEqual(['09:00', '14:00'])
    expect(days[0]?.breaks).toEqual([{ startTime: '15:00', endTime: '16:00' }])
    expect(days[6]?.shifts).toEqual([{ startTime: '10:00', endTime: '18:00' }])
  })
})
