import { describe, expect, it } from 'vitest'

import { DEFAULT_SETTINGS, type AdminSettingsDto } from '@barber/shared'

import {
  SETTING_FIELDS,
  SETTING_KEYS,
  changedSettingKeys,
  settingsServerErrors,
  settingsToForm,
  validateSettingsForm,
} from './settings'

const SAVED: AdminSettingsDto = { ...DEFAULT_SETTINGS }

describe('settingsToForm', () => {
  it('переводит все ключи контракта в строки', () => {
    const form = settingsToForm(SAVED)
    expect(Object.keys(form).sort()).toEqual([...SETTING_KEYS].sort())
    expect(form.slot_step_min).toBe('15')
    expect(form.timezone).toBe('Asia/Tashkent')
  })
})

describe('часовой пояс только для чтения', () => {
  it('поле помечено как readOnly и описано как время салона', () => {
    const field = SETTING_FIELDS.find(item => item.key === 'timezone')
    expect(field?.readOnly).toBe(true)
    expect(field?.help).toBe(
      'Время салона. Вся система считает время по этому поясу; меняется только вместе с кодом',
    )
  })

  it('остальные настройки редактируемы', () => {
    expect(SETTING_FIELDS.filter(field => !field.readOnly).map(field => field.key)).toEqual(
      SETTING_KEYS.filter(key => key !== 'timezone'),
    )
  })
})

describe('validateSettingsForm', () => {
  it('корректные значения собираются в тело PUT без часового пояса', () => {
    const { errors, input } = validateSettingsForm(settingsToForm(SAVED))
    expect(errors).toEqual({})
    const { timezone: _timezone, ...editable } = SAVED
    expect(input).toEqual(editable)
    expect(input).not.toHaveProperty('timezone')
  })

  it('ошибки по полям с диапазоном из контракта', () => {
    const { errors, input } = validateSettingsForm({
      ...settingsToForm(SAVED),
      slot_step_min: '7',
      booking_horizon_days: '',
      review_public_min_rating: '9',
    })
    expect(input).toBeNull()
    expect(errors.slot_step_min).toBe('Допустимо: от 5 до 240, кратно 5')
    expect(errors.booking_horizon_days).toBe('Допустимо: от 1 до 365')
    expect(errors.review_public_min_rating).toBe('Допустимо: от 1 до 5')
  })

  it('дробные числа отклоняются', () => {
    const { errors, input } = validateSettingsForm({
      ...settingsToForm(SAVED),
      cancel_cutoff_min: '10.5',
    })
    expect(input).toBeNull()
    expect(errors.cancel_cutoff_min).toBeDefined()
  })

  it('часовой пояс не проверяется и не попадает в тело, даже если значение испорчено', () => {
    const { errors, input } = validateSettingsForm({ ...settingsToForm(SAVED), timezone: 'Mars/Olympus' })
    expect(errors).toEqual({})
    expect(input).not.toBeNull()
    expect(input).not.toHaveProperty('timezone')
  })
})

describe('settingsServerErrors', () => {
  it('раскладывает ошибки 422 по ключам и переводит английские тексты', () => {
    expect(
      settingsServerErrors([
        { path: 'slot_step_min', message: 'Number must be a multiple of 5' },
        { path: 'timezone', message: 'Неизвестный часовой пояс' },
        { path: '', message: 'Unrecognized key' },
      ]),
    ).toEqual({
      slot_step_min: 'Значение не подходит. Допустимо: от 5 до 240, кратно 5',
      timezone: 'Неизвестный часовой пояс. Укажите название пояса, например Asia/Tashkent',
      form: 'Проверьте настройки',
    })
  })

  it('неизвестный формат details даёт пустой результат', () => {
    expect(settingsServerErrors('строка')).toEqual({})
  })
})

describe('changedSettingKeys', () => {
  it('возвращает только изменённые ключи', () => {
    const values = { ...settingsToForm(SAVED), slot_step_min: '30' }
    expect(changedSettingKeys(SAVED, values)).toEqual(['slot_step_min'])
  })

  it('часовой пояс никогда не попадает в отправляемые изменения', () => {
    const values = { ...settingsToForm(SAVED), timezone: 'Europe/Moscow' }
    expect(changedSettingKeys(SAVED, values)).toEqual([])
    expect(changedSettingKeys(SAVED, values)).not.toContain('timezone')
  })
})
