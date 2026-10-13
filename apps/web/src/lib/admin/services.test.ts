import { describe, expect, it } from 'vitest'

import type { AdminServiceDto } from '@barber/shared'

import { ApiRequestError } from '../api'
import {
  describeDeleteResult,
  describeServiceError,
  emptyServiceForm,
  nextSortOrder,
  serviceToForm,
  toServiceInput,
  validateServiceForm,
  type ServiceFormValues,
} from './services'

const VALID: ServiceFormValues = {
  name: '  Стрижка  ',
  description: ' Классика ',
  durationMin: '45',
  price: '120 000',
  sortOrder: '3',
  isActive: true,
}

describe('validateServiceForm', () => {
  it('accepts a valid form', () => {
    expect(validateServiceForm(VALID)).toEqual({})
  })

  it('requires a name of at least two characters after trimming', () => {
    expect(validateServiceForm({ ...VALID, name: '  A ' }).name).toMatch(/не меньше 2/)
  })

  it('limits the name to 80 characters', () => {
    expect(validateServiceForm({ ...VALID, name: 'я'.repeat(81) }).name).toMatch(/не больше 80/)
  })

  it('rejects duration outside 5..480 and non-integers', () => {
    expect(validateServiceForm({ ...VALID, durationMin: '4' }).durationMin).toBeDefined()
    expect(validateServiceForm({ ...VALID, durationMin: '481' }).durationMin).toBeDefined()
    expect(validateServiceForm({ ...VALID, durationMin: '30.5' }).durationMin).toBeDefined()
    expect(validateServiceForm({ ...VALID, durationMin: '' }).durationMin).toBeDefined()
  })

  it('accepts price with thousand separators but rejects negatives and decimals', () => {
    expect(validateServiceForm({ ...VALID, price: '0' })).toEqual({})
    expect(validateServiceForm({ ...VALID, price: '-1' }).price).toBeDefined()
    expect(validateServiceForm({ ...VALID, price: '12.5' }).price).toBeDefined()
    expect(validateServiceForm({ ...VALID, price: '100000001' }).price).toBeDefined()
  })

  it('limits sort order to 0..10000', () => {
    expect(validateServiceForm({ ...VALID, sortOrder: '-1' }).sortOrder).toBeDefined()
    expect(validateServiceForm({ ...VALID, sortOrder: '10001' }).sortOrder).toBeDefined()
  })

  it('limits the description to 1000 characters', () => {
    expect(validateServiceForm({ ...VALID, description: 'а'.repeat(1001) }).description).toBeDefined()
  })
})

describe('toServiceInput', () => {
  it('trims text and converts numeric strings', () => {
    expect(toServiceInput(VALID)).toEqual({
      name: 'Стрижка',
      description: 'Классика',
      durationMin: 45,
      price: 120000,
      sortOrder: 3,
      isActive: true,
    })
  })
})

describe('form helpers', () => {
  it('builds an empty form with the suggested order', () => {
    expect(emptyServiceForm(7)).toMatchObject({ name: '', sortOrder: '7', isActive: true })
  })

  it('maps a service to form values', () => {
    const service: AdminServiceDto = {
      id: '1',
      name: 'Борода',
      description: '',
      durationMin: 20,
      price: 50000,
      isActive: false,
      sortOrder: 2,
    }
    expect(serviceToForm(service)).toEqual({
      name: 'Борода',
      description: '',
      durationMin: '20',
      price: '50000',
      sortOrder: '2',
      isActive: false,
    })
  })

  it('suggests the order after the largest existing one', () => {
    expect(nextSortOrder([])).toBe(0)
    expect(
      nextSortOrder([
        { id: 'a', name: 'A', description: '', durationMin: 30, price: 1, isActive: true, sortOrder: 4 },
        { id: 'b', name: 'B', description: '', durationMin: 30, price: 1, isActive: true, sortOrder: 1 },
      ]),
    ).toBe(5)
  })
})

describe('describeDeleteResult', () => {
  it('reports a real deletion', () => {
    expect(describeDeleteResult('Стрижка', { mode: 'deleted' })).toEqual({
      tone: 'success',
      text: 'Услуга «Стрижка» удалена.',
    })
  })

  it('explains that a service with history is hidden, not deleted', () => {
    const result = describeDeleteResult('Стрижка', { mode: 'deactivated' })
    expect(result.tone).toBe('warning')
    expect(result.text).toMatch(/скрыта, а не удалена/)
  })
})

describe('describeServiceError', () => {
  it('explains validation failures in service terms', () => {
    expect(describeServiceError(new ApiRequestError('VALIDATION_ERROR', 'x', 422))).toMatch(/поля формы/)
  })

  it('explains a missing service', () => {
    expect(describeServiceError(new ApiRequestError('NOT_FOUND', 'x', 404))).toMatch(/не найдена/)
  })

  it('explains network failures', () => {
    expect(describeServiceError(new ApiRequestError('NETWORK_ERROR', 'x', 0))).toMatch(/Нет связи/)
  })

  it('falls back to a generic message for unknown errors', () => {
    expect(describeServiceError('boom')).toMatch(/Что-то пошло не так/)
  })
})
