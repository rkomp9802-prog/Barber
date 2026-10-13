import { describe, expect, it } from 'vitest'
import {
  addDaysToKey,
  dateKeyInZone,
  dayBoundsUtc,
  isValidDateKey,
  parseHhmm,
  timeInZone,
  weekdayOfKey,
  zoneOffsetMin,
  zonedToUtc,
} from '../../src/domain/time'

const TZ = 'Asia/Tashkent'

describe('время Ташкента', () => {
  it('смещение всегда +5 часов: летом и зимой (нет перехода на летнее время)', () => {
    expect(zoneOffsetMin(Date.parse('2026-01-15T00:00:00Z'), TZ)).toBe(300)
    expect(zoneOffsetMin(Date.parse('2026-07-15T00:00:00Z'), TZ)).toBe(300)
    expect(zoneOffsetMin(Date.parse('2026-03-29T01:30:00Z'), TZ)).toBe(300)
  })

  it('местное 10:00 → 05:00 UTC', () => {
    expect(new Date(zonedToUtc('2026-10-12', 600, TZ)).toISOString()).toBe('2026-10-12T05:00:00.000Z')
  })

  it('местная полночь → 19:00 UTC предыдущего дня', () => {
    expect(new Date(zonedToUtc('2026-10-12', 0, TZ)).toISOString()).toBe('2026-10-11T19:00:00.000Z')
  })

  it('дата и время по Ташкенту из UTC', () => {
    const late = Date.parse('2026-10-11T20:30:00Z')
    expect(dateKeyInZone(late, TZ)).toBe('2026-10-12')
    expect(timeInZone(late, TZ)).toBe('01:30')
  })

  it('границы местного дня — 24 часа', () => {
    const bounds = dayBoundsUtc('2026-10-12', TZ)
    expect(bounds.end - bounds.start).toBe(24 * 3_600_000)
  })

  it('работает и с поясом с переходом на летнее время', () => {
    // 2026-03-29 — переход в Берлине; 12:00 местного = 10:00 UTC (CEST).
    expect(new Date(zonedToUtc('2026-03-29', 720, 'Europe/Berlin')).toISOString()).toBe('2026-03-29T10:00:00.000Z')
  })
})

describe('даты и часы', () => {
  it('parseHhmm', () => {
    expect(parseHhmm('00:00')).toBe(0)
    expect(parseHhmm('14:30')).toBe(870)
    expect(parseHhmm('24:00')).toBe(1440)
    expect(() => parseHhmm('9:00')).toThrow()
    expect(() => parseHhmm('24:30')).toThrow()
  })

  it('addDaysToKey переходит через месяц и год', () => {
    expect(addDaysToKey('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDaysToKey('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDaysToKey('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('weekdayOfKey: 0 = воскресенье', () => {
    expect(weekdayOfKey('2026-10-11')).toBe(0)
    expect(weekdayOfKey('2026-10-12')).toBe(1)
  })

  it('isValidDateKey отбрасывает несуществующие даты', () => {
    expect(isValidDateKey('2026-02-28')).toBe(true)
    expect(isValidDateKey('2026-02-30')).toBe(false)
    expect(isValidDateKey('2026-2-3')).toBe(false)
  })
})
