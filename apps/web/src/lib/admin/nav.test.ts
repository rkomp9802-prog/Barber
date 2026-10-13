import { describe, expect, it } from 'vitest'

import { isNavItemActive } from './nav'

describe('isNavItemActive', () => {
  it('marks the section page as active', () => {
    expect(isNavItemActive('/admin/services', '/admin/services')).toBe(true)
  })

  it('marks nested pages of a section as active', () => {
    expect(isNavItemActive('/admin/bookings/42', '/admin/bookings')).toBe(true)
  })

  it('does not match a different section sharing a prefix', () => {
    expect(isNavItemActive('/admin/barbers-old', '/admin/barbers')).toBe(false)
    expect(isNavItemActive('/admin/bookings', '/admin/services')).toBe(false)
  })
})
