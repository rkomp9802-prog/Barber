import { describe, expect, it } from 'vitest'

import {
  EMPTY_TIME_OFF_FILTERS,
  EMPTY_TIME_OFF_FORM,
  applyTypeChange,
  buildTimeOffQuery,
  describeTimeOffPeriod,
  hasActiveTimeOffFilters,
  isoToLocal,
  localToIso,
  readValidationIssues,
  timeOffScopeLabel,
  timeOffServerErrors,
  timeOffToForm,
  validateTimeOffFilters,
  validateTimeOffForm,
} from './timeOff'

const BARBER_ID = '6f1c1d2e-3a4b-4c5d-8e9f-0a1b2c3d4e5f'

describe('localToIso / isoToLocal', () => {
  it('переводит время Ташкента в UTC и обратно', () => {
    expect(localToIso('2026-10-13T10:00')).toBe('2026-10-13T05:00:00.000Z')
    expect(isoToLocal('2026-10-13T05:00:00.000Z')).toBe('2026-10-13T10:00')
  });

  it('возвращает пустую строку для нечитаемого значения', () => {
    expect(localToIso('')).toBe('')
    expect(isoToLocal('не дата')).toBe('')
  })
})

describe('buildTimeOffQuery', () => {
  it('отбрасывает пустые поля', () => {
    expect(buildTimeOffQuery(EMPTY_TIME_OFF_FILTERS)).toEqual({
      from: undefined,
      to: undefined,
      barberId: undefined,
    })
  })

  it('передаёт период и barberId, в том числе shop', () => {
    expect(buildTimeOffQuery({ from: '2026-10-01', to: '2026-10-31', barberId: 'shop' })).toEqual({
      from: '2026-10-01',
      to: '2026-10-31',
      barberId: 'shop',
    })
  })

  it('определяет активные фильтры', () => {
    expect(hasActiveTimeOffFilters(EMPTY_TIME_OFF_FILTERS)).toBe(false)
    expect(hasActiveTimeOffFilters({ ...EMPTY_TIME_OFF_FILTERS, barberId: BARBER_ID })).toBe(true)
  })
})

describe('validateTimeOffFilters', () => {
  it('требует, чтобы «с» не было позже «по»', () => {
    expect(validateTimeOffFilters({ from: '2026-10-05', to: '2026-10-01', barberId: '' })).toBe(
      'Дата «с» не может быть позже даты «по»',
    )
    expect(validateTimeOffFilters({ from: '2026-10-01', to: '2026-10-05', barberId: '' })).toBeNull()
    expect(validateTimeOffFilters(EMPTY_TIME_OFF_FILTERS)).toBeNull()
  })
})

describe('validateTimeOffForm', () => {
  const valid = {
    ...EMPTY_TIME_OFF_FORM,
    barberId: BARBER_ID,
    type: 'vacation' as const,
    startsAt: '2026-10-20T00:00',
    endsAt: '2026-10-25T00:00',
    note: '  Поездка  ',
  }

  it('собирает вход API: пустой барбер — null, заметка обрезается', () => {
    const { errors, input } = validateTimeOffForm(valid)
    expect(errors).toEqual({})
    expect(input).toEqual({
      barberId: BARBER_ID,
      startsAt: '2026-10-19T19:00:00.000Z',
      endsAt: '2026-10-24T19:00:00.000Z',
      type: 'vacation',
      note: 'Поездка',
    })
  })

  it('весь салон отправляет barberId null и пустую заметку как null', () => {
    const { input } = validateTimeOffForm({ ...valid, barberId: '', note: '   ' })
    expect(input?.barberId).toBeNull()
    expect(input?.note).toBeNull()
  })

  it('требует даты и окончание позже начала', () => {
    const empty = validateTimeOffForm({ ...valid, startsAt: '', endsAt: '2026-10-19T00:00' })
    expect(empty.input).toBeNull()
    expect(empty.errors.startsAt).toBe('Укажите начало')

    const reversed = validateTimeOffForm({ ...valid, startsAt: '2026-10-20T00:00', endsAt: '2026-10-19T00:00' })
    expect(reversed.input).toBeNull()
    expect(reversed.errors.endsAt).toBe('Окончание должно быть позже начала')
  })

  it('shop_closed нельзя привязать к барберу', () => {
    const { errors } = validateTimeOffForm({ ...valid, type: 'shop_closed' })
    expect(errors.barberId).toBeDefined()
  })

  it('ограничивает заметку 500 символами', () => {
    const { errors } = validateTimeOffForm({ ...valid, note: 'а'.repeat(501) })
    expect(errors.note).toBe('Не больше 500 символов')
  })
})

describe('applyTypeChange', () => {
  it('для «Салон закрыт» сбрасывает барбера', () => {
    const form = { ...EMPTY_TIME_OFF_FORM, barberId: BARBER_ID }
    expect(applyTypeChange(form, 'shop_closed')).toMatchObject({ type: 'shop_closed', barberId: '' })
    expect(applyTypeChange(form, 'sick')).toMatchObject({ type: 'sick', barberId: BARBER_ID })
  })
})

describe('timeOffToForm', () => {
  it('переводит DTO в значения формы', () => {
    expect(
      timeOffToForm({
        id: 'x',
        barberId: null,
        barberName: null,
        startsAt: '2026-10-13T05:00:00.000Z',
        endsAt: '2026-10-13T13:00:00.000Z',
        type: 'shop_closed',
        note: null,
      }),
    ).toEqual({
      barberId: '',
      type: 'shop_closed',
      startsAt: '2026-10-13T10:00',
      endsAt: '2026-10-13T18:00',
      note: '',
    })
  })
})

describe('ошибки сервера', () => {
  const details = [
    { path: 'startsAt', message: 'Invalid datetime' },
    { path: 'note', message: 'Слишком длинная заметка' },
    { path: '', message: 'Something wrong' },
  ]

  it('читает массив issues и игнорирует прочее', () => {
    expect(readValidationIssues(details)).toHaveLength(3)
    expect(readValidationIssues({ foo: 1 })).toEqual([])
    expect(readValidationIssues(undefined)).toEqual([])
  })

  it('раскладывает по полям, английские сообщения заменяются русскими', () => {
    expect(timeOffServerErrors(details)).toEqual({
      startsAt: 'Проверьте значение',
      note: 'Слишком длинная заметка',
      form: 'Проверьте данные исключения',
    })
  })
})

describe('отображение', () => {
  it('период в один день показывает одну дату', () => {
    expect(
      describeTimeOffPeriod({
        startsAt: '2026-10-13T05:00:00.000Z',
        endsAt: '2026-10-13T13:00:00.000Z',
      }),
    ).toContain('10:00')
  })

  it('подпись области: барбер или весь салон', () => {
    expect(timeOffScopeLabel({ barberName: null })).toBe('Весь салон')
    expect(timeOffScopeLabel({ barberName: 'Рустам' })).toBe('Рустам')
  })
})
