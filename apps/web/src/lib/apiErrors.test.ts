import { describe, expect, it } from 'vitest'

import { ApiRequestError } from './api'
import { UNKNOWN_ERROR_MESSAGE, describeSubmitError, errorMessage } from './apiErrors'

describe('describeSubmitError', () => {
  it('sends the client back to the time step when the slot was taken', () => {
    const info = describeSubmitError(new ApiRequestError('SLOT_TAKEN', 'занято', 409))
    expect(info.step).toBe('time')
    expect(info.message).toBe('Это время только что заняли. Выберите другое.')
  })

  it('sends the client to the barber step when the service is unavailable', () => {
    expect(describeSubmitError(new ApiRequestError('SERVICE_UNAVAILABLE', 'x', 422)).step).toBe('barber')
  })

  it('keeps the user on the confirm step for unknown errors', () => {
    const info = describeSubmitError(new Error('Что-то сломалось'))
    expect(info).toEqual({ message: 'Что-то сломалось', step: 'confirm' })
    expect(describeSubmitError('oops')).toEqual({ message: UNKNOWN_ERROR_MESSAGE, step: 'confirm' })
  })
})

describe('errorMessage', () => {
  it('prefers the client wording over the server message for known codes', () => {
    expect(errorMessage(new ApiRequestError('NETWORK_ERROR', 'raw', 0))).toMatch(/^Нет связи/)
  })

  it('falls back to the server message for codes without a client wording', () => {
    expect(errorMessage(new ApiRequestError('FORBIDDEN', 'Доступ закрыт', 403))).toBe('Доступ закрыт')
  })
})
