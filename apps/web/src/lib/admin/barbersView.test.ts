import { describe, expect, it } from 'vitest'

import type { AdminBarberServiceDto, AdminServiceDto } from '@barber/shared'

import { ApiRequestError } from '../api'
import {
  BARBER_DEFAULT_ROLE,
  barberErrorMessage,
  buildServiceRows,
  deleteResultMessage,
  emptyCreateForm,
  movePortfolioIds,
  parseOptionalInt,
  photoFileError,
  validateBarberFields,
  validateServiceRows,
  type BarberFieldsForm,
} from './barbersView'

const VALID: BarberFieldsForm = {
  name: '  Тимур  ',
  role: '',
  bio: 'Фейды и борода',
  experienceYears: '5',
  sortOrder: '',
  isActive: true,
}

describe('validateBarberFields', () => {
  it('trims the name and falls back to the default role and zero numbers', () => {
    const result = validateBarberFields(VALID)
    expect(result).toEqual({
      ok: true,
      value: { name: 'Тимур', role: BARBER_DEFAULT_ROLE, bio: 'Фейды и борода', experienceYears: 5, sortOrder: 0, isActive: true },
    })
  })

  it('rejects a too short name', () => {
    expect(validateBarberFields({ ...VALID, name: 'А' })).toEqual({ ok: false, error: 'Имя: от 2 до 60 символов.' })
  })

  it('rejects experience out of range', () => {
    const result = validateBarberFields({ ...VALID, experienceYears: '61' })
    expect(result.ok).toBe(false)
  })

  it('requires a name in the create form, other defaults are valid', () => {
    expect(validateBarberFields(emptyCreateForm()).ok).toBe(false)
    expect(validateBarberFields({ ...emptyCreateForm(), name: 'Тимур' }).ok).toBe(true)
  })
})

describe('parseOptionalInt', () => {
  it('returns null for an empty field', () => {
    expect(parseOptionalInt('  ', 5, 480, 'Длительность')).toEqual({ ok: true, value: null })
  })

  it('rejects non-integers and out of range values', () => {
    expect(parseOptionalInt('1.5', 5, 480, 'Длительность').ok).toBe(false)
    expect(parseOptionalInt('4', 5, 480, 'Длительность')).toEqual({ ok: false, error: 'Длительность: от 5 до 480.' })
  })
})

describe('barberErrorMessage', () => {
  it('показывает русское сообщение сервера при VALIDATION_ERROR', () => {
    const error = new ApiRequestError('VALIDATION_ERROR', 'Имя слишком короткое', 422)
    expect(barberErrorMessage(error)).toBe('Имя слишком короткое')
  })

  it('заменяет английский текст zod на общий русский', () => {
    const error = new ApiRequestError('VALIDATION_ERROR', 'Too small: expected string to have >=2 characters', 422)
    expect(barberErrorMessage(error)).toBe('Проверьте поля формы и попробуйте ещё раз.')
  })

  it('пустое сообщение валидации заменяется общим текстом', () => {
    const error = new ApiRequestError('VALIDATION_ERROR', '', 422)
    expect(barberErrorMessage(error)).toBe('Проверьте поля формы и попробуйте ещё раз.')
  })
})

describe('deleteResultMessage', () => {
  it('explains that a deleted barber was only hidden when it has history', () => {
    expect(deleteResultMessage({ mode: 'deactivated' }, 'Тимур')).toMatch(/скрыт, а не удалён/)
  })

  it('confirms a real deletion', () => {
    expect(deleteResultMessage({ mode: 'deleted' }, 'Тимур')).toBe('«Тимур» удалён.')
  })
})

describe('service rows', () => {
  const catalog: AdminServiceDto[] = [
    { id: 's1', name: 'Стрижка', description: '', durationMin: 45, price: 80000, isActive: true, sortOrder: 0 },
    { id: 's2', name: 'Борода', description: '', durationMin: 30, price: 40000, isActive: true, sortOrder: 1 },
  ]
  const current: AdminBarberServiceDto[] = [
    {
      serviceId: 's1',
      name: 'Стрижка',
      isEnabled: true,
      durationMin: 60,
      price: null,
      effectiveDurationMin: 60,
      effectivePrice: 80000,
    },
  ]

  it('keeps the current overrides and disables services the barber does not have', () => {
    const rows = buildServiceRows(catalog, current)
    expect(rows[0]).toEqual({ serviceId: 's1', name: 'Стрижка', isEnabled: true, durationMin: '60', price: '' })
    expect(rows[1]).toEqual({ serviceId: 's2', name: 'Борода', isEnabled: false, durationMin: '', price: '' })
  })

  it('turns empty overrides into null in the request', () => {
    const result = validateServiceRows(buildServiceRows(catalog, current))
    expect(result).toEqual({
      ok: true,
      value: {
        services: [
          { serviceId: 's1', isEnabled: true, durationMin: 60, price: null },
          { serviceId: 's2', isEnabled: false, durationMin: null, price: null },
        ],
      },
    })
  })

  it('reports a bad override with the service name', () => {
    const rows = buildServiceRows(catalog, current).map(row => (row.serviceId === 's2' ? { ...row, price: '-5' } : row))
    const result = validateServiceRows(rows)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/«Борода»: цена/)
  })
})

describe('photoFileError', () => {
  it('accepts jpeg, png and webp up to the limit', () => {
    expect(photoFileError({ type: 'image/webp', size: 1024 })).toBeNull()
  })

  it('rejects other types, empty and oversized files', () => {
    expect(photoFileError({ type: 'image/gif', size: 1024 })).toMatch(/JPEG, PNG или WebP/)
    expect(photoFileError({ type: 'image/png', size: 0 })).toBe('Файл пустой.')
    expect(photoFileError({ type: 'image/png', size: 6 * 1024 * 1024 })).toMatch(/больше 5 МБ/)
  })
})

describe('movePortfolioIds', () => {
  const ids = ['a', 'b', 'c']

  it('swaps an item with its neighbour', () => {
    expect(movePortfolioIds(ids, 1, -1)).toEqual(['b', 'a', 'c'])
    expect(movePortfolioIds(ids, 1, 1)).toEqual(['a', 'c', 'b'])
  })

  it('returns null at the edges', () => {
    expect(movePortfolioIds(ids, 0, -1)).toBeNull()
    expect(movePortfolioIds(ids, 2, 1)).toBeNull()
  })

  it('does not mutate the input', () => {
    movePortfolioIds(ids, 0, 1)
    expect(ids).toEqual(['a', 'b', 'c'])
  })
})
