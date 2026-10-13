import { API_ERROR_CODES } from '@barber/shared'
import { describe, expect, it } from 'vitest'

import { ApiRequestError } from './api'
import { CUTOFF_HINT, errorCode, errorMessage, SLOT_TAKEN_MESSAGE } from './errors'

const apiError = (code: ConstructorParameters<typeof ApiRequestError>[0]): ApiRequestError =>
  new ApiRequestError(code, 'server text', 422)

describe('errorMessage', () => {
  it('explains SLOT_TAKEN in plain Russian', () => {
    expect(errorMessage(apiError('SLOT_TAKEN'))).toBe(SLOT_TAKEN_MESSAGE)
    expect(SLOT_TAKEN_MESSAGE).toContain('Это время только что заняли')
  })

  it('uses the cutoff hint for CUTOFF_PASSED', () => {
    expect(errorMessage(apiError('CUTOFF_PASSED'))).toBe(CUTOFF_HINT)
    expect(CUTOFF_HINT).toBe('Изменить можно не позже чем за 30 минут до начала')
  })

  it('has a distinct Russian message for every API error code', () => {
    const messages = API_ERROR_CODES.map(code => errorMessage(apiError(code)))
    messages.forEach(message => expect(message).toMatch(/[а-яё]/i))
    expect(new Set(messages).size).toBe(API_ERROR_CODES.length)
  })

  it('never shows raw server text', () => {
    expect(errorMessage(apiError('INTERNAL'))).not.toContain('server text')
  })

  it('handles network and unknown errors', () => {
    expect(errorMessage(apiError('NETWORK_ERROR'))).toContain('Нет связи')
    expect(errorMessage(new Error('boom'))).toBe('Что-то пошло не так. Попробуйте ещё раз.')
    expect(errorMessage('oops')).toBe('Что-то пошло не так. Попробуйте ещё раз.')
  })
})

describe('errorCode', () => {
  it('returns the code of ApiRequestError and UNKNOWN otherwise', () => {
    expect(errorCode(apiError('TOO_SOON'))).toBe('TOO_SOON')
    expect(errorCode(new Error('x'))).toBe('UNKNOWN')
  })
})
