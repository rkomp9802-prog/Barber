import { describe, expect, it } from 'vitest'

import { formatUzPhone, isValidUzPhone, toE164UzPhone, uzLocalDigits } from './phone'

describe('uz phone', () => {
  it('strips the country code and non-digits', () => {
    expect(uzLocalDigits('+998 (90) 123-45-67')).toBe('901234567')
    expect(uzLocalDigits('901234567999')).toBe('901234567')
  })

  it('formats partial and full input', () => {
    expect(formatUzPhone('')).toBe('+998')
    expect(formatUzPhone('9012')).toBe('+998 90 12')
    expect(formatUzPhone('+998901234567')).toBe('+998 90 123 45 67')
  })

  it('validates and converts to E.164', () => {
    expect(isValidUzPhone('+998 90 123 45 6')).toBe(false)
    expect(isValidUzPhone('+998 90 123 45 67')).toBe(true)
    expect(toE164UzPhone('+998 90 123 45 67')).toBe('+998901234567')
  })
})
