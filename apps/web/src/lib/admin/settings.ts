import {
  settingValueSchemas,
  type AdminSettingsDto,
  type AdminSettingsInput,
} from '@barber/shared'

import { readValidationIssues, russianOrFallback } from './timeOff'

/*
 * Настройки салона. Ограничения берутся из контракта (settingValueSchemas в @barber/shared),
 * здесь — только подписи, подсказки и перевод текстов ошибок на русский.
 */

export type SettingKey = keyof AdminSettingsDto

export type SettingField = {
  key: SettingKey
  label: string
  /** Что означает значение и в каких единицах. */
  help: string
  /** Допустимый диапазон для подписи ошибки; для часового пояса не нужен. */
  range?: string
  kind: 'number' | 'timezone'
  /** Только для чтения: не редактируется и никогда не уходит в PUT /admin/settings. */
  readOnly?: boolean
}

export const SETTING_FIELDS: readonly SettingField[] = [
  {
    key: 'cancel_cutoff_min',
    label: 'Отмена и перенос записи не позже, минут до визита',
    help: 'Клиент не сможет отменить или перенести запись, если до визита меньше этого времени. 0 — можно до начала.',
    range: 'от 0 до 10080 (7 дней)',
    kind: 'number',
  },
  {
    key: 'slot_step_min',
    label: 'Шаг слотов, минут',
    help: 'Через какой интервал предлагаются времена записи.',
    range: 'от 5 до 240, кратно 5',
    kind: 'number',
  },
  {
    key: 'booking_horizon_days',
    label: 'Запись открыта на, дней вперёд',
    help: 'Как далеко вперёд клиенты могут выбрать дату.',
    range: 'от 1 до 365',
    kind: 'number',
  },
  {
    key: 'min_notice_min',
    label: 'Минимум времени до записи, минут',
    help: 'Нельзя записаться на время, которое начинается раньше, чем через это время.',
    range: 'от 0 до 10080 (7 дней)',
    kind: 'number',
  },
  {
    key: 'reminder_day_minutes',
    label: 'Напоминание за день до визита, минут',
    help: 'За сколько минут до визита отправить первое напоминание. 1440 — сутки.',
    range: 'от 60 до 10080',
    kind: 'number',
  },
  {
    key: 'reminder_short_minutes',
    label: 'Короткое напоминание, минут до визита',
    help: 'За сколько минут до визита отправить напоминание, когда клиент уже близко.',
    range: 'от 5 до 1440',
    kind: 'number',
  },
  {
    key: 'review_delay_min',
    label: 'Попросить отзыв через, минут после визита',
    help: 'Задержка перед просьбой оставить отзыв после завершения записи.',
    range: 'от 0 до 10080 (7 дней)',
    kind: 'number',
  },
  {
    key: 'review_public_min_rating',
    label: 'Минимальная оценка для показа на сайте',
    help: 'Отзывы с оценкой ниже этой не попадают на сайт автоматически.',
    range: 'от 1 до 5',
    kind: 'number',
  },
  {
    key: 'timezone',
    label: 'Часовой пояс салона',
    help: 'Время салона. Вся система считает время по этому поясу; меняется только вместе с кодом',
    kind: 'timezone',
    readOnly: true,
  },
]

export const SETTING_KEYS: readonly SettingKey[] = SETTING_FIELDS.map(field => field.key)

/** Поля, которые админ может менять; только они проверяются и уходят в PUT /admin/settings. */
const EDITABLE_FIELDS: readonly SettingField[] = SETTING_FIELDS.filter(field => !field.readOnly)

/** Значения формы — строки, чтобы поле можно было очистить и ввести заново. */
export type SettingsFormValues = Record<SettingKey, string>

export function settingsToForm(settings: AdminSettingsDto): SettingsFormValues {
  return Object.fromEntries(SETTING_KEYS.map(key => [key, String(settings[key])])) as SettingsFormValues
}

export type SettingsFormErrors = Partial<Record<SettingKey | 'form', string>>

type Checker = { safeParse: (value: unknown) => { success: boolean } }
/** Проверка по контракту: тот же набор правил, что и на сервере. */
const checkers: Record<SettingKey, Checker> = settingValueSchemas

function fieldHint(field: SettingField): string {
  if (field.kind === 'timezone') return 'Укажите название пояса, например Asia/Tashkent'
  return `Допустимо: ${field.range}`
}

/** Преобразует строку поля в значение контракта; NaN и дробные числа контракт отклонит. */
function toSettingValue(field: SettingField, raw: string): string | number {
  const trimmed = raw.trim()
  if (field.kind === 'timezone') return trimmed
  return trimmed === '' ? Number.NaN : Number(trimmed)
}

/** Клиентская проверка по контракту; при успехе возвращает тело для PUT /admin/settings. */
export function validateSettingsForm(values: SettingsFormValues): {
  errors: SettingsFormErrors
  input: AdminSettingsInput | null
} {
  const errors: SettingsFormErrors = {}
  const input: Record<string, string | number> = {}

  // Поля только для чтения (часовой пояс) не проверяются и в тело запроса не попадают.
  for (const field of EDITABLE_FIELDS) {
    const value = toSettingValue(field, values[field.key])
    if (!checkers[field.key].safeParse(value).success) {
      errors[field.key] = fieldHint(field)
      continue
    }
    input[field.key] = value
  }

  if (Object.keys(errors).length > 0) return { errors, input: null }
  return { errors, input: input as AdminSettingsInput }
}

/** Ошибки 422 от PUT /admin/settings: раскладываем по ключам, сообщения переводим. */
export function settingsServerErrors(details: unknown): SettingsFormErrors {
  const errors: SettingsFormErrors = {}
  for (const issue of readValidationIssues(details)) {
    const field = SETTING_FIELDS.find(item => item.key === issue.path)
    if (field) errors[field.key] = `${russianOrFallback(issue.message, 'Значение не подходит')}. ${fieldHint(field)}`
    else errors.form = russianOrFallback(issue.message, 'Проверьте настройки')
  }
  return errors
}

/** Ключи редактируемых настроек, значение которых отличается от сохранённого. Часовой пояс сюда не попадает. */
export function changedSettingKeys(saved: AdminSettingsDto, values: SettingsFormValues): SettingKey[] {
  return EDITABLE_FIELDS.map(field => field.key).filter(key => String(saved[key]) !== values[key].trim())
}
