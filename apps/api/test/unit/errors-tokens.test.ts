import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { loadConfig } from '../../src/config'
import { AppError, isExclusionViolation, toAppError } from '../../src/errors'
import { generateManageToken, isWellFormedManageToken, maskTokenInUrl } from '../../src/lib/tokens'

describe('toAppError', () => {
  it('Prisma + driver adapter 23P01 → 409 SLOT_TAKEN', () => {
    const prismaError = {
      code: 'P2010',
      meta: { driverAdapterError: { name: 'DriverAdapterError', cause: { kind: 'postgres', code: '23P01', originalCode: '23P01' } } },
    }
    expect(isExclusionViolation(prismaError)).toBe(true)
    expect(toAppError(prismaError)).toMatchObject({ code: 'SLOT_TAKEN', statusCode: 409 })
  })

  it('ошибка pg напрямую с кодом 23P01', () => {
    expect(isExclusionViolation({ code: '23P01', message: 'conflicting key value violates exclusion constraint' })).toBe(true)
    expect(isExclusionViolation(new Error('other'))).toBe(false)
  })

  it('ZodError → 422 VALIDATION_ERROR с деталями', () => {
    const result = z.object({ a: z.string() }).safeParse({})
    const appError = toAppError(result.error)
    expect(appError).toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 422 })
    expect(appError.details).toEqual([{ path: 'a', message: expect.any(String) }])
  })

  it('неизвестная ошибка → INTERNAL без утечки сообщения', () => {
    const appError = toAppError(new Error('password=secret'))
    expect(appError).toMatchObject({ code: 'INTERNAL', statusCode: 500 })
    expect(appError.message).not.toContain('secret')
  })

  it('AppError сохраняется как есть', () => {
    const original = new AppError('CUTOFF_PASSED')
    expect(toAppError(original)).toBe(original)
    expect(original.statusCode).toBe(422)
  })
})

describe('manage token', () => {
  it('43 символа base64url, каждый раз новый', () => {
    const a = generateManageToken()
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(isWellFormedManageToken(a)).toBe(true)
    expect(generateManageToken()).not.toBe(a)
    expect(isWellFormedManageToken('short')).toBe(false)
  })

  it('токен в URL маскируется для логов', () => {
    expect(maskTokenInUrl('/api/v1/bookings/abcDEF_123/cancel?x=1')).toBe('/api/v1/bookings/***/cancel?x=1')
  })
})

describe('loadConfig', () => {
  it('падает без DATABASE_URL (fail fast)', () => {
    expect(() => loadConfig({})).toThrow(/DATABASE_URL/)
  })

  it('разбирает CORS_ORIGINS и значения по умолчанию', () => {
    const config = loadConfig({
      DATABASE_URL: 'postgresql://u:p@host:6543/postgres?pgbouncer=true',
      CORS_ORIGINS: 'https://a.uz, https://b.uz',
      TELEGRAM_BOT_USERNAME: '@sharp_bot',
    })
    expect(config.corsOrigins).toEqual(['https://a.uz', 'https://b.uz'])
    expect(config.port).toBe(4000)
    expect(config.telegram.botUsername).toBe('sharp_bot')
    expect(config.telegram.botToken).toBeUndefined()
  })
})
