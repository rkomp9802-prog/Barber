import { describe, expect, it } from 'vitest'

import { toQueryString } from './request'

describe('toQueryString', () => {
  it('returns an empty string when every value is skipped', () => {
    expect(toQueryString({ a: undefined, b: null, c: '' })).toBe('')
  })

  it('serializes primitives and skips empty values', () => {
    expect(toQueryString({ page: 2, from: '2026-10-01', to: undefined, isPublic: false })).toBe(
      '?page=2&from=2026-10-01&isPublic=false',
    )
  })

  it('keeps zero and false as real filter values', () => {
    expect(toQueryString({ minRating: 0, isPublic: false })).toBe('?minRating=0&isPublic=false')
  })
})
