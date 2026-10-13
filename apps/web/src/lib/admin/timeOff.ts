import {
  TIME_OFF_TYPES,
  type AdminTimeOffCreateInput,
  type AdminTimeOffDto,
  type AdminTimeOffQuery,
  type TimeOffType,
} from '@barber/shared'

import { formatTashkentDay, formatTashkentTime } from './datetime'

/*
 * Исключения (выходные, отпуск, закрытие салона). Все моменты времени — в Asia/Tashkent (UTC+5, без перехода на летнее).
 * Поля datetime-local хранят значение 'YYYY-MM-DDTHH:mm' в этом часовом поясе.
 */

const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000

export const TIME_OFF_TYPE_LABELS: Readonly<Record<TimeOffType, string>> = {
  day_off: 'Выходной',
  vacation: 'Отпуск',
  sick: 'Больничный',
  other: 'Другое',
  shop_closed: 'Салон закрыт',
}

export const TIME_OFF_TYPE_OPTIONS: readonly TimeOffType[] = TIME_OFF_TYPES

/* ---------- Фильтры списка ---------- */

/** barberId: '' — все исключения, 'shop' — только салон целиком, иначе uuid барбера. */
export type TimeOffFilters = {
  from: string
  to: string
  barberId: string
}

export const EMPTY_TIME_OFF_FILTERS: TimeOffFilters = { from: '', to: '', barberId: '' }

function nonEmpty(value: string): string | undefined {
  const trimmed = value.trim()
  return trimmed === '' ? undefined : trimmed
}

/** Параметры GET /admin/time-off; пустые поля отбрасываются. */
export function buildTimeOffQuery(filters: TimeOffFilters): AdminTimeOffQuery {
  return {
    from: nonEmpty(filters.from),
    to: nonEmpty(filters.to),
    barberId: nonEmpty(filters.barberId),
  }
}

export function hasActiveTimeOffFilters(filters: TimeOffFilters): boolean {
  return Object.values(filters).some(value => value.trim() !== '')
}

/** Ошибка фильтра периода или null, если фильтр корректен. */
export function validateTimeOffFilters(filters: TimeOffFilters): string | null {
  if (filters.from && filters.to && filters.from > filters.to) {
    return 'Дата «с» не может быть позже даты «по»'
  }
  return null
}

/* ---------- Конвертация времени формы ---------- */

/** 'YYYY-MM-DDTHH:mm' (Ташкент) → ISO UTC; пустая строка — если значение не разбирается. */
export function localToIso(local: string): string {
  const ms = Date.parse(`${local}:00+05:00`)
  return Number.isNaN(ms) ? '' : new Date(ms).toISOString()
}

/** ISO UTC → 'YYYY-MM-DDTHH:mm' по Ташкенту для поля datetime-local. */
export function isoToLocal(iso: string): string {
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) return ''
  return new Date(ms + TASHKENT_OFFSET_MS).toISOString().slice(0, 16)
}

/* ---------- Форма создания/редактирования ---------- */

/** barberId: '' — весь салон (null в API). */
export type TimeOffForm = {
  barberId: string
  type: TimeOffType
  startsAt: string
  endsAt: string
  note: string
}

export const EMPTY_TIME_OFF_FORM: TimeOffForm = {
  barberId: '',
  type: 'day_off',
  startsAt: '',
  endsAt: '',
  note: '',
}

export type TimeOffFormField = 'barberId' | 'type' | 'startsAt' | 'endsAt' | 'note'
export type TimeOffFormErrors = Partial<Record<TimeOffFormField | 'form', string>>

export function timeOffToForm(item: AdminTimeOffDto): TimeOffForm {
  return {
    barberId: item.barberId ?? '',
    type: item.type,
    startsAt: isoToLocal(item.startsAt),
    endsAt: isoToLocal(item.endsAt),
    note: item.note ?? '',
  }
}

/** Тип «Салон закрыт» действует только на весь салон: при выборе барбер сбрасывается. */
export function applyTypeChange(form: TimeOffForm, type: TimeOffType): TimeOffForm {
  return type === 'shop_closed' ? { ...form, type, barberId: '' } : { ...form, type }
}

export function validateTimeOffForm(form: TimeOffForm): {
  errors: TimeOffFormErrors
  input: AdminTimeOffCreateInput | null
} {
  const errors: TimeOffFormErrors = {}
  const startsAt = form.startsAt ? localToIso(form.startsAt) : ''
  const endsAt = form.endsAt ? localToIso(form.endsAt) : ''

  if (!startsAt) errors.startsAt = 'Укажите начало'
  if (!endsAt) errors.endsAt = 'Укажите окончание'
  if (startsAt && endsAt && Date.parse(endsAt) <= Date.parse(startsAt)) {
    errors.endsAt = 'Окончание должно быть позже начала'
  }
  if (form.type === 'shop_closed' && form.barberId) {
    errors.barberId = 'Закрытие салона действует на весь салон: выберите «Весь салон»'
  }
  if (form.note.trim().length > 500) errors.note = 'Не больше 500 символов'

  if (Object.keys(errors).length > 0) return { errors, input: null }
  return {
    errors,
    input: {
      barberId: form.barberId || null,
      startsAt,
      endsAt,
      type: form.type,
      note: form.note.trim() || null,
    },
  }
}

/* ---------- Ошибки сервера ---------- */

export type ValidationIssue = { path: string; message: string }

/** details из ошибки 422/400: массив { path, message }. Другой формат даёт пустой список. */
export function readValidationIssues(details: unknown): ValidationIssue[] {
  if (!Array.isArray(details)) return []
  return details.flatMap(item => {
    if (typeof item !== 'object' || item === null) return []
    const record = item as Record<string, unknown>
    if (typeof record.path !== 'string' || typeof record.message !== 'string') return []
    return [{ path: record.path, message: record.message }]
  })
}

const FORM_FIELDS: readonly TimeOffFormField[] = ['barberId', 'type', 'startsAt', 'endsAt', 'note']
const GENERIC_FIELD_MESSAGE = 'Проверьте значение'

/** Сообщения сервера (zod) часто на английском: тогда показываем общий русский текст. */
export function russianOrFallback(message: string, fallback: string): string {
  return /[а-яё]/i.test(message) ? message : fallback
}

/** Раскладывает ошибки сервера по полям формы; корневые ошибки уходят в form. */
export function timeOffServerErrors(details: unknown): TimeOffFormErrors {
  const errors: TimeOffFormErrors = {}
  for (const issue of readValidationIssues(details)) {
    const field = FORM_FIELDS.find(name => name === issue.path)
    if (field) errors[field] = russianOrFallback(issue.message, GENERIC_FIELD_MESSAGE)
    else errors.form = russianOrFallback(issue.message, 'Проверьте данные исключения')
  }
  return errors
}

/* ---------- Отображение ---------- */

/** «пн, 13 окт., 10:00 – 18:00» или с датами, если период через несколько дней. */
export function describeTimeOffPeriod(item: Pick<AdminTimeOffDto, 'startsAt' | 'endsAt'>): string {
  const startDay = formatTashkentDay(item.startsAt)
  const endDay = formatTashkentDay(item.endsAt)
  const start = formatTashkentTime(item.startsAt)
  const end = formatTashkentTime(item.endsAt)
  if (startDay === endDay) return `${startDay}, ${start}–${end}`
  return `${startDay}, ${start} – ${endDay}, ${end}`
}

export function timeOffScopeLabel(item: Pick<AdminTimeOffDto, 'barberName'>): string {
  return item.barberName ?? 'Весь салон'
}
