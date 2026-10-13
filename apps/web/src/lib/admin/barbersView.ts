import {
  ADMIN_UPLOAD_CONTENT_TYPES,
  ADMIN_UPLOAD_MAX_BYTES,
  TIMEZONE,
  type AdminBarberDto,
  type AdminBarberServiceDto,
  type AdminBarberServicesInput,
  type AdminDeleteResult,
  type AdminServiceDto,
  type AdminUploadInput,
} from '@barber/shared'

import { isApiRequestError } from '../api'
import { errorMessage } from '../apiErrors'
import { russianOrFallback } from './timeOff'

/*
 * Чистые функции раздела «Барберы»: формы → входные данные API, проверки и тексты сообщений.
 * Без React и без сети, поэтому покрыты тестами.
 */

export const BARBER_DEFAULT_ROLE = 'Барбер'
export const PORTFOLIO_MAX_ITEMS = 200

export type BarberFields = {
  name: string
  role: string
  bio: string
  experienceYears: number
  sortOrder: number
  isActive: boolean
}

export type BarberFieldsForm = {
  name: string
  role: string
  bio: string
  experienceYears: string
  sortOrder: string
  isActive: boolean
}

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string }

/** Пустая строка — null; иначе целое число в диапазоне. */
export function parseOptionalInt(raw: string, min: number, max: number, label: string): ParseResult<number | null> {
  const text = raw.trim()
  if (text === '') return { ok: true, value: null }
  if (!/^\d+$/.test(text)) return { ok: false, error: `${label}: укажите целое число.` }
  const value = Number(text)
  if (value < min || value > max) return { ok: false, error: `${label}: от ${min} до ${max}.` }
  return { ok: true, value }
}

/**
 * Текст ошибки API. Для VALIDATION_ERROR берём русское сообщение сервера, английский текст zod заменяем общим.
 * Общие тексты ERROR_MESSAGES про телефон здесь не подходят.
 */
export function barberErrorMessage(error: unknown): string {
  if (isApiRequestError(error, 'VALIDATION_ERROR')) {
    return russianOrFallback(error.message, 'Проверьте поля формы и попробуйте ещё раз.')
  }
  return errorMessage(error)
}

export function profileToForm(barber: AdminBarberDto): BarberFieldsForm {
  return {
    name: barber.name,
    role: barber.role,
    bio: barber.bio,
    experienceYears: String(barber.experienceYears),
    sortOrder: String(barber.sortOrder),
    isActive: barber.isActive,
  }
}

export function emptyCreateForm(): BarberFieldsForm {
  return { name: '', role: BARBER_DEFAULT_ROLE, bio: '', experienceYears: '0', sortOrder: '0', isActive: true }
}

/** Проверка полей барбера; при ошибке возвращает первое сообщение. */
export function validateBarberFields(form: BarberFieldsForm): ParseResult<BarberFields> {
  const name = form.name.trim()
  if (name.length < 2 || name.length > 60) return { ok: false, error: 'Имя: от 2 до 60 символов.' }
  const role = form.role.trim()
  if (role.length > 60) return { ok: false, error: 'Роль: не длиннее 60 символов.' }
  const bio = form.bio.trim()
  if (bio.length > 1000) return { ok: false, error: 'Био: не длиннее 1000 символов.' }
  const experience = parseOptionalInt(form.experienceYears, 0, 60, 'Стаж (лет)')
  if (!experience.ok) return experience
  const sortOrder = parseOptionalInt(form.sortOrder, 0, 10_000, 'Порядок')
  if (!sortOrder.ok) return sortOrder
  return {
    ok: true,
    value: {
      name,
      role: role || BARBER_DEFAULT_ROLE,
      bio,
      experienceYears: experience.value ?? 0,
      sortOrder: sortOrder.value ?? 0,
      isActive: form.isActive,
    },
  }
}

/** Сообщение после DELETE: удаление может превратиться в скрытие, если есть история записей. */
export function deleteResultMessage(result: AdminDeleteResult, name: string): string {
  if (result.mode === 'deactivated') {
    return `«${name}» скрыт, а не удалён: у барбера есть записи в истории. Он не будет показываться клиентам.`
  }
  return `«${name}» удалён.`
}

export function telegramLabel(linked: boolean): string {
  return linked ? 'Telegram привязан' : 'Telegram не привязан'
}

/* ---------- Услуги барбера ---------- */

export type ServiceRowForm = {
  serviceId: string
  name: string
  isEnabled: boolean
  /** Пустая строка — брать из услуги. */
  durationMin: string
  /** Пустая строка — брать из услуги. */
  price: string
}

/** Строки для всего каталога: текущие настройки барбера, для остальных — выключено и без переопределений. */
export function buildServiceRows(catalog: readonly AdminServiceDto[], current: readonly AdminBarberServiceDto[]): ServiceRowForm[] {
  return catalog.map(service => {
    const existing = current.find(item => item.serviceId === service.id)
    return {
      serviceId: service.id,
      name: service.name,
      isEnabled: existing?.isEnabled ?? false,
      durationMin: existing?.durationMin === null || existing?.durationMin === undefined ? '' : String(existing.durationMin),
      price: existing?.price === null || existing?.price === undefined ? '' : String(existing.price),
    }
  })
}

export function validateServiceRows(rows: readonly ServiceRowForm[]): ParseResult<AdminBarberServicesInput> {
  const services: AdminBarberServicesInput['services'] = []
  for (const row of rows) {
    const duration = parseOptionalInt(row.durationMin, 5, 480, `«${row.name}»: длительность (мин)`)
    if (!duration.ok) return duration
    const price = parseOptionalInt(row.price, 0, 100_000_000, `«${row.name}»: цена (сум)`)
    if (!price.ok) return price
    services.push({
      serviceId: row.serviceId,
      isEnabled: row.isEnabled,
      durationMin: duration.value,
      price: price.value,
    })
  }
  return { ok: true, value: { services } }
}

/* ---------- Фото ---------- */

/** MIME-тип, который принимает загрузка, или null для остальных. */
export function uploadContentType(type: string): AdminUploadInput['contentType'] | null {
  return (ADMIN_UPLOAD_CONTENT_TYPES as readonly string[]).includes(type)
    ? (type as AdminUploadInput['contentType'])
    : null
}

/** Проверка файла до загрузки: тип и размер. Возвращает текст ошибки или null. */
export function photoFileError(file: { type: string; size: number }): string | null {
  if (uploadContentType(file.type) === null) return 'Допустимы только JPEG, PNG или WebP.'
  if (file.size > ADMIN_UPLOAD_MAX_BYTES) {
    return `Файл больше ${ADMIN_UPLOAD_MAX_BYTES / (1024 * 1024)} МБ. Выберите файл меньше.`
  }
  if (file.size === 0) return 'Файл пустой.'
  return null
}

/* ---------- Портфолио ---------- */

/** Новый порядок id после сдвига элемента на один шаг; null — двигать нельзя. */
export function movePortfolioIds(ids: readonly string[], index: number, delta: -1 | 1): string[] | null {
  const target = index + delta
  if (index < 0 || index >= ids.length || target < 0 || target >= ids.length) return null
  const next = [...ids]
  const [moved] = next.splice(index, 1)
  if (moved === undefined) return null
  next.splice(target, 0, moved)
  return next
}

/* ---------- Telegram и даты ---------- */

/** Дата и время в Ташкенте для срока кода привязки. */
export function formatTashkentDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: TIMEZONE,
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}
