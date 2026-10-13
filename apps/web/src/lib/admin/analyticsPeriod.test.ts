import { describe, expect, it } from 'vitest'

import {
  addDays,
  inclusiveDays,
  isDateKey,
  matchPreset,
  presetRange,
  tashkentToday,
  validatePeriod,
} from './analyticsPeriod'

/** Момент в UTC; для Ташкента (UTC+5) добавляется 5 часов. */
const utc = (iso: string) => new Date(iso)

describe('tashkentToday', () => {
  it('переходит на следующий день по Ташкенту раньше, чем по UTC', () => {
    // 20:00 UTC 13 октября = 01:00 14 октября в Ташкенте.
    expect(tashkentToday(utc('2026-10-13T20:00:00Z'))).toBe('2026-10-14')
  })

  it('остаётся в текущем дне до полуночи по Ташкенту', () => {
    // 18:59 UTC = 23:59 в Ташкенте.
    expect(tashkentToday(utc('2026-10-13T18:59:59Z'))).toBe('2026-10-13')
    // 19:00 UTC = 00:00 14 октября в Ташкенте.
    expect(tashkentToday(utc('2026-10-13T19:00:00Z'))).toBe('2026-10-14')
  })

  it('переносит год на границе 31 декабря / 1 января', () => {
    expect(tashkentToday(utc('2026-12-31T19:30:00Z'))).toBe('2027-01-01')
  })
})

describe('addDays', () => {
  it('переходит через конец месяца и года', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31')
  })

  it('учитывает високосный февраль', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2028-02-29', 1)).toBe('2028-03-01')
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01')
  })
})

describe('presetRange', () => {
  // Сегодня в Ташкенте — 14 октября 2026 (момент 20:00 UTC 13 октября).
  const now = utc('2026-10-13T20:00:00Z')

  it('«7 дней» — последние 7 дней включая сегодня', () => {
    expect(presetRange('last7', now)).toEqual({ from: '2026-10-08', to: '2026-10-14' })
    expect(inclusiveDays(presetRange('last7', now))).toBe(7)
  })

  it('«30 дней» — последние 30 дней включая сегодня', () => {
    expect(presetRange('last30', now)).toEqual({ from: '2026-09-15', to: '2026-10-14' })
    expect(inclusiveDays(presetRange('last30', now))).toBe(30)
  })

  it('«Этот месяц» — весь календарный месяц', () => {
    expect(presetRange('thisMonth', now)).toEqual({ from: '2026-10-01', to: '2026-10-31' })
  })

  it('«Прошлый месяц» — предыдущий календарный месяц', () => {
    expect(presetRange('lastMonth', now)).toEqual({ from: '2026-09-01', to: '2026-09-30' })
  })

  it('прошлый месяц для января уходит в предыдущий год', () => {
    expect(presetRange('lastMonth', utc('2027-01-10T06:00:00Z'))).toEqual({
      from: '2026-12-01',
      to: '2026-12-31',
    })
  })

  it('прошлый месяц для марта високосного года — весь февраль (29 дней)', () => {
    expect(presetRange('lastMonth', utc('2028-03-05T06:00:00Z'))).toEqual({
      from: '2028-02-01',
      to: '2028-02-29',
    })
  })

  it('прошлый месяц для марта невисокосного года — февраль на 28 дней', () => {
    expect(presetRange('lastMonth', utc('2027-03-05T06:00:00Z'))).toEqual({
      from: '2027-02-01',
      to: '2027-02-28',
    })
  })

  it('на 1 марта по Ташкенту «прошлый месяц» — февраль, а не январь по UTC-дате', () => {
    // 29 февраля 2028, 20:00 UTC = 1 марта 2028, 01:00 по Ташкенту (2028 — високосный).
    expect(presetRange('lastMonth', utc('2028-02-29T20:00:00Z'))).toEqual({
      from: '2028-02-01',
      to: '2028-02-29',
    })
  })

  it('«Этот месяц» для декабря заканчивается 31 числом', () => {
    expect(presetRange('thisMonth', utc('2026-12-20T06:00:00Z'))).toEqual({
      from: '2026-12-01',
      to: '2026-12-31',
    })
  })
})

describe('validatePeriod', () => {
  it('принимает обычный период', () => {
    expect(validatePeriod({ from: '2026-10-01', to: '2026-10-31' })).toBeNull()
  })

  it('принимает одну дату как период в один день', () => {
    expect(validatePeriod({ from: '2026-10-05', to: '2026-10-05' })).toBeNull()
  })

  it('отклоняет пустые и неполные даты', () => {
    expect(validatePeriod({ from: '', to: '2026-10-05' })).not.toBeNull()
    expect(validatePeriod({ from: '2026-10-01', to: '2026-1-5' })).not.toBeNull()
  })

  it('отклоняет несуществующие даты', () => {
    expect(isDateKey('2026-02-30')).toBe(false)
    expect(validatePeriod({ from: '2026-02-30', to: '2026-03-05' })).not.toBeNull()
    expect(isDateKey('2028-02-29')).toBe(true)
    expect(isDateKey('2027-02-29')).toBe(false)
  })

  it('отклоняет начало позже конца', () => {
    expect(validatePeriod({ from: '2026-10-02', to: '2026-10-01' })).not.toBeNull()
  })

  it('допускает ровно 366 дней и отклоняет 367', () => {
    // 2025-01-01 .. 2026-01-01: 365 дней разницы + 1 за включение обеих границ.
    expect(inclusiveDays({ from: '2025-01-01', to: '2026-01-01' })).toBe(366)
    expect(validatePeriod({ from: '2025-01-01', to: '2026-01-01' })).toBeNull()
    expect(validatePeriod({ from: '2025-01-01', to: '2026-01-02' })).not.toBeNull()
  })

  it('длина периода через високосный февраль считается верно', () => {
    expect(inclusiveDays({ from: '2028-02-01', to: '2028-02-29' })).toBe(29)
    expect(inclusiveDays({ from: '2027-02-01', to: '2027-02-28' })).toBe(28)
  })
})

describe('matchPreset', () => {
  const now = utc('2026-10-13T20:00:00Z')

  it('узнаёт быстрый период по совпадению границ', () => {
    expect(matchPreset({ from: '2026-09-01', to: '2026-09-30' }, now)).toBe('lastMonth')
    expect(matchPreset({ from: '2026-09-15', to: '2026-10-14' }, now)).toBe('last30')
  })

  it('возвращает null для произвольного периода', () => {
    expect(matchPreset({ from: '2026-10-02', to: '2026-10-14' }, now)).toBeNull()
  })
})
