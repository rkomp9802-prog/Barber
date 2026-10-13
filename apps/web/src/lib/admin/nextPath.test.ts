import { describe, expect, it } from 'vitest'

import { ADMIN_HOME_PATH, loginHref, sanitizeNextPath } from './nextPath'

describe('sanitizeNextPath', () => {
  it('keeps internal admin paths', () => {
    expect(sanitizeNextPath('/admin/services')).toBe('/admin/services')
    expect(sanitizeNextPath('/admin/bookings/123')).toBe('/admin/bookings/123')
  })

  it('falls back to bookings for missing values', () => {
    expect(sanitizeNextPath(undefined)).toBe(ADMIN_HOME_PATH)
    expect(sanitizeNextPath(null)).toBe(ADMIN_HOME_PATH)
    expect(sanitizeNextPath('')).toBe(ADMIN_HOME_PATH)
  })

  it('rejects paths outside the admin area', () => {
    expect(sanitizeNextPath('/book')).toBe(ADMIN_HOME_PATH)
    expect(sanitizeNextPath('/admin')).toBe(ADMIN_HOME_PATH)
    expect(sanitizeNextPath('//evil.example/admin/')).toBe(ADMIN_HOME_PATH)
    expect(sanitizeNextPath('https://evil.example/admin/x')).toBe(ADMIN_HOME_PATH)
  })

  it('rejects backslashes, whitespace and control characters', () => {
    expect(sanitizeNextPath('/admin/\\evil')).toBe(ADMIN_HOME_PATH)
    expect(sanitizeNextPath('/admin/a b')).toBe(ADMIN_HOME_PATH)
    expect(sanitizeNextPath('/admin/a\nb')).toBe(ADMIN_HOME_PATH)
  })

  it('does not loop back to the login page', () => {
    expect(sanitizeNextPath('/admin/login')).toBe(ADMIN_HOME_PATH)
    expect(sanitizeNextPath('/admin/login?next=/admin/x')).toBe(ADMIN_HOME_PATH)
  })
})

describe('loginHref', () => {
  it('encodes the return path', () => {
    expect(loginHref('/admin/barbers')).toBe('/admin/login?next=%2Fadmin%2Fbarbers')
  })

  it('does not carry an unsafe path into the next parameter', () => {
    expect(loginHref('/elsewhere')).toBe(`/admin/login?next=${encodeURIComponent(ADMIN_HOME_PATH)}`)
  })
})
