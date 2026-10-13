import type { AdminDeleteResult, AdminServiceCreateInput, AdminServiceDto } from '@barber/shared'

import { isApiRequestError } from '../api'
import { errorMessage } from '../apiErrors'

/*
 * Чистая логика формы и результатов для страницы «Услуги».
 * Ограничения повторяют adminServiceCreateSchema из packages/shared/src/admin-api/catalog.ts.
 */

export const SERVICE_NAME_MIN = 2
export const SERVICE_NAME_MAX = 80
export const SERVICE_DESCRIPTION_MAX = 1000
export const SERVICE_DURATION_MIN = 5
export const SERVICE_DURATION_MAX = 480
export const SERVICE_PRICE_MAX = 100_000_000
export const SERVICE_SORT_MAX = 10_000

/** Значения полей формы: всё строками, как их вводит пользователь. */
export type ServiceFormValues = {
  name: string
  description: string
  durationMin: string
  price: string
  sortOrder: string
  isActive: boolean
}

export type ServiceFormField = keyof ServiceFormValues
export type ServiceFormErrors = Partial<Record<ServiceFormField, string>>

export function emptyServiceForm(suggestedSortOrder = 0): ServiceFormValues {
  return {
    name: '',
    description: '',
    durationMin: '30',
    price: '',
    sortOrder: String(suggestedSortOrder),
    isActive: true,
  }
}

export function serviceToForm(service: AdminServiceDto): ServiceFormValues {
  return {
    name: service.name,
    description: service.description,
    durationMin: String(service.durationMin),
    price: String(service.price),
    sortOrder: String(service.sortOrder),
    isActive: service.isActive,
  }
}

/** Следующий порядок после максимального; для пустого списка — 0. */
export function nextSortOrder(services: readonly AdminServiceDto[]): number {
  return services.reduce((max, service) => Math.max(max, service.sortOrder + 1), 0)
}

/** Строка → целое число; дробные и нечисловые значения → null. */
function parseWhole(text: string): number | null {
  const trimmed = text.trim()
  if (!/^-?\d+$/.test(trimmed)) return null
  return Number(trimmed)
}

/** Цена допускает пробелы-разделители тысяч: «120 000» = 120000. */
function parsePrice(text: string): number | null {
  const digits = text.replace(/\s/g, '')
  if (!/^\d+$/.test(digits)) return null
  return Number(digits)
}

/** Пустой объект — форма корректна. */
export function validateServiceForm(values: ServiceFormValues): ServiceFormErrors {
  const errors: ServiceFormErrors = {}

  const name = values.name.trim()
  if (name.length < SERVICE_NAME_MIN) errors.name = `Название — не меньше ${SERVICE_NAME_MIN} символов`
  else if (name.length > SERVICE_NAME_MAX) errors.name = `Название — не больше ${SERVICE_NAME_MAX} символов`

  if (values.description.trim().length > SERVICE_DESCRIPTION_MAX) {
    errors.description = `Описание — не больше ${SERVICE_DESCRIPTION_MAX} символов`
  }

  const duration = parseWhole(values.durationMin)
  if (duration === null) errors.durationMin = 'Укажите длительность целым числом минут'
  else if (duration < SERVICE_DURATION_MIN || duration > SERVICE_DURATION_MAX) {
    errors.durationMin = `Длительность — от ${SERVICE_DURATION_MIN} до ${SERVICE_DURATION_MAX} минут`
  }

  const price = parsePrice(values.price)
  if (price === null) errors.price = 'Укажите цену целым числом сумов, например 120000'
  else if (price > SERVICE_PRICE_MAX) errors.price = 'Цена — не больше 100 000 000 сум'

  const sortOrder = parseWhole(values.sortOrder)
  if (sortOrder === null) errors.sortOrder = 'Порядок — целое число'
  else if (sortOrder < 0 || sortOrder > SERVICE_SORT_MAX) {
    errors.sortOrder = `Порядок — от 0 до ${SERVICE_SORT_MAX}`
  }

  return errors
}

/** Тело запроса из формы. Вызывать только для формы без ошибок валидации. */
export function toServiceInput(values: ServiceFormValues): AdminServiceCreateInput {
  return {
    name: values.name.trim(),
    description: values.description.trim(),
    durationMin: Number(values.durationMin.trim()),
    price: Number(values.price.replace(/\s/g, '')),
    sortOrder: Number(values.sortOrder.trim()),
    isActive: values.isActive,
  }
}

/** Итог DELETE: «deactivated» — услуга осталась в истории записей и только скрыта. */
export function describeDeleteResult(name: string, result: AdminDeleteResult): { tone: 'success' | 'warning'; text: string } {
  if (result.mode === 'deleted') return { tone: 'success', text: `Услуга «${name}» удалена.` }
  return {
    tone: 'warning',
    text: `Услуга «${name}» скрыта, а не удалена: она есть в истории записей. Клиенты её не видят. Чтобы вернуть, откройте услугу и отметьте «Активна».`,
  }
}

/** Понятный текст ошибки для операций над услугами. */
export function describeServiceError(error: unknown): string {
  if (isApiRequestError(error, 'VALIDATION_ERROR')) {
    return 'Сервер не принял данные. Проверьте поля формы и попробуйте ещё раз.'
  }
  if (isApiRequestError(error, 'NOT_FOUND')) {
    return 'Услуга не найдена. Возможно, её уже удалили. Обновите список.'
  }
  return errorMessage(error)
}
