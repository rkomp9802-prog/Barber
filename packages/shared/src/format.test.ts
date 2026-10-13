import { describe, expect, it } from 'vitest'

import {
  formatDayMonth,
  formatDuration,
  formatPrice,
  nextDateKeys,
  plural,
  tashkentDateKey,
  weekdayOf,
} from './format'

describe('formatPrice', () => {
  it('splits thousands with spaces and adds the currency', () => {
    expect(formatPrice(120000)).toBe('120 000 сум')
    expect(formatPrice(1500000)).toBe('1 500 000 сум')
  })
})

describe('formatDuration', () => {
  it('formats minutes, hours and mixed durations', () => {
    expect(formatDuration(45)).toBe('45 мин')
    expect(formatDuration(120)).toBe('2 ч')
    expect(formatDuration(90)).toBe('1 ч 30 мин')
  })
})

describe('tashkentDateKey', () => {
  it('uses the Tashkent day, not the UTC day', () => {
    // 20:30 UTC = 01:30 следующего дня в Ташкенте (UTC+5)
    expect(tashkentDateKey(new Date('2026-10-05T20:30:00Z'))).toBe('2026-10-06')
    expect(tashkentDateKey(new Date('2026-10-05T10:00:00Z'))).toBe('2026-10-05')
  })
})

describe('nextDateKeys', () => {
  it('returns consecutive days starting today', () => {
    expect(nextDateKeys(new Date('2026-10-30T10:00:00Z'), 3)).toEqual(['2026-10-30', '2026-10-31', '2026-11-01'])
  })
})

describe('weekdayOf and formatDayMonth', () => {
  it('reads the weekday and month of a date key', () => {
    expect(weekdayOf('2026-10-11')).toBe(0)
    expect(formatDayMonth('2026-10-05')).toBe('5 октября')
  })
})

describe('plural', () => {
  const forms = ['отзыв', 'отзыва', 'отзывов'] as const
  it('picks the Russian plural form', () => {
    expect(plural(1, forms)).toBe('отзыв')
    expect(plural(3, forms)).toBe('отзыва')
    expect(plural(11, forms)).toBe('отзывов')
    expect(plural(21, forms)).toBe('отзыв')
    expect(plural(25, forms)).toBe('отзывов')
  })
})
