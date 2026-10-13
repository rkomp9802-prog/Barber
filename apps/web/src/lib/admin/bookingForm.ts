import {
  formatUzPhone,
  isValidUzPhone,
  uzLocalDigits,
  TIMEZONE,
  tashkentDateKey,
  toE164UzPhone,
  type AdminBarberDto,
  type AdminBookingCreateInput,
  type AdminBookingUpdateInput,
  type AdminServiceDto,
  type BookingStatus,
} from '@barber/shared'

import { isApiRequestError } from '../api'
import { errorMessage } from '../apiErrors'

/*
 * Чистая логика форм админки записей: время в Ташкенте (UTC+5, без перехода на летнее),
 * валидация полей, сборка тел запросов и тексты ошибок API. Без React — покрыто тестами.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/
const DAY_MS = 24 * 60 * 60 * 1000

/** Ручная запись: не дальше 365 дней вперёд (контракт, booking_horizon_days здесь не применяется). */
export const MANUAL_HORIZON_DAYS = 365
export const MANUAL_MAX_SERVICES = 5
export const CLIENT_NAME_MIN = 2
export const CLIENT_NAME_MAX = 60

const tashkentDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const tashkentTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/** Дата YYYY-MM-DD и время HH:MM по Ташкенту из ISO-момента (для полей формы). */
export function isoToTashkentParts(iso: string): { date: string; time: string } {
  const moment = new Date(iso)
  return { date: tashkentDateFormatter.format(moment), time: tashkentTimeFormatter.format(moment) }
}

/** Дата и время, введённые администратором по Ташкенту, → ISO UTC. null, если значения некорректны. */
export function tashkentToIso(date: string, time: string): string | null {
  if (!DATE_RE.test(date) || !TIME_RE.test(time)) return null
  const moment = Date.parse(`${date}T${time}:00+05:00`)
  if (Number.isNaN(moment)) return null
  // Отсекаем несуществующие даты вроде 2026-02-31, которые Date.parse молча переносит.
  const back = isoToTashkentParts(new Date(moment).toISOString())
  if (back.date !== date || back.time !== time) return null
  return new Date(moment).toISOString()
}

/** Текст ошибки поля даты/времени для ручной записи или переноса; null — всё в порядке. */
export function dateTimeError(date: string, time: string, now: Date = new Date()): string | null {
  if (!DATE_RE.test(date)) return 'Укажите дату.'
  if (!TIME_RE.test(time)) return 'Укажите время.'
  if (tashkentToIso(date, time) === null) return 'Такой даты не существует.'
  if (date < tashkentDateKey(now)) return 'Нельзя записать на прошедшую дату.'
  const horizon = tashkentDateKey(new Date(now.getTime() + MANUAL_HORIZON_DAYS * DAY_MS))
  if (date > horizon) return `Запись возможна не дальше ${MANUAL_HORIZON_DAYS} дней вперёд.`
  return null
}

export function clientNameError(name: string): string | null {
  const length = name.trim().length
  if (length < CLIENT_NAME_MIN || length > CLIENT_NAME_MAX) {
    return `Имя клиента — от ${CLIENT_NAME_MIN} до ${CLIENT_NAME_MAX} символов.`
  }
  return null
}

export function clientPhoneError(phone: string): string | null {
  return isValidUzPhone(phone) ? null : 'Телефон в формате +998 и 9 цифр.'
}

/** Поле телефона: пустой ввод остаётся пустым, иначе маска «+998 90 123 45 67». */
export function maskPhoneInput(raw: string): string {
  return uzLocalDigits(raw) === '' ? '' : formatUzPhone(raw)
}

/* ---------- Ручная запись ---------- */

export type BookingCreateDraft = {
  barberId: string
  serviceIds: readonly string[]
  date: string
  time: string
  clientName: string
  phone: string
  force: boolean
}

export type ServiceOption = {
  id: string
  name: string
  durationMin: number
  price: number
}

/** Услуги, которые выбранный барбер оказывает и которые активны в каталоге, с его итоговыми ценой и длительностью. */
export function serviceOptionsFor(
  barber: AdminBarberDto | undefined,
  services: readonly AdminServiceDto[],
): ServiceOption[] {
  if (!barber) return []
  const active = new Set(services.filter(service => service.isActive).map(service => service.id))
  return barber.services
    .filter(item => item.isEnabled && active.has(item.serviceId))
    .map(item => ({
      id: item.serviceId,
      name: item.name,
      durationMin: item.effectiveDurationMin,
      price: item.effectivePrice,
    }))
}

/** Сумма и длительность выбранных услуг. */
export function summarizeServices(
  options: readonly ServiceOption[],
  selectedIds: readonly string[],
): { price: number; durationMin: number } {
  const chosen = options.filter(option => selectedIds.includes(option.id))
  return {
    price: chosen.reduce((sum, option) => sum + option.price, 0),
    durationMin: chosen.reduce((sum, option) => sum + option.durationMin, 0),
  }
}

/** Проверяет черновик и собирает тело POST /admin/bookings; при ошибке — текст для пользователя. */
export function buildCreateInput(
  draft: BookingCreateDraft,
  now: Date = new Date(),
): { input: AdminBookingCreateInput } | { error: string } {
  if (!draft.barberId) return { error: 'Выберите барбера.' }
  if (draft.serviceIds.length === 0) return { error: 'Выберите хотя бы одну услугу.' }
  if (draft.serviceIds.length > MANUAL_MAX_SERVICES) {
    return { error: `Можно выбрать не больше ${MANUAL_MAX_SERVICES} услуг.` }
  }
  const timeProblem = dateTimeError(draft.date, draft.time, now)
  if (timeProblem) return { error: timeProblem }
  const nameProblem = clientNameError(draft.clientName)
  if (nameProblem) return { error: nameProblem }
  const phoneProblem = clientPhoneError(draft.phone)
  if (phoneProblem) return { error: phoneProblem }

  const startsAt = tashkentToIso(draft.date, draft.time)
  if (startsAt === null) return { error: 'Такой даты не существует.' }
  return {
    input: {
      barberId: draft.barberId,
      serviceIds: [...draft.serviceIds],
      startsAt,
      client: { name: draft.clientName.trim(), phone: toE164UzPhone(draft.phone) },
      force: draft.force,
    },
  }
}

/* ---------- Карточка записи ---------- */

/** Статус «завершена» и «не пришёл» ставятся только после начала записи (контракт). */
export function canMarkAfterStart(startsAt: string, now: Date = new Date()): boolean {
  return Date.parse(startsAt) <= now.getTime()
}

/** Менять статус и время можно только у подтверждённой записи. */
export function isBookingActive(status: BookingStatus): boolean {
  return status === 'confirmed'
}

/** Тело PATCH для смены статуса. Сюда не попадает confirmed: контракт такой цели не принимает. */
export function buildStatusInput(status: 'completed' | 'no_show' | 'cancelled'): AdminBookingUpdateInput {
  return { status }
}

/** Тело PATCH для переноса: новое время по Ташкенту и флаг force. */
export function buildRescheduleInput(
  draft: { date: string; time: string; force: boolean },
  now: Date = new Date(),
): { input: AdminBookingUpdateInput } | { error: string } {
  const problem = dateTimeError(draft.date, draft.time, now)
  if (problem) return { error: problem }
  const startsAt = tashkentToIso(draft.date, draft.time)
  if (startsAt === null) return { error: 'Такой даты не существует.' }
  return { input: { startsAt, force: draft.force } }
}

/** Текст ошибки API для админских операций с записью; неизвестные коды — общий текст. */
export function adminBookingErrorMessage(error: unknown): string {
  if (isApiRequestError(error)) {
    switch (error.code) {
      case 'SLOT_TAKEN':
        return 'Время уже занято. Выберите другое время.'
      case 'OUTSIDE_WORKING_HOURS':
        return 'Это время вне графика барбера (нерабочее время, обед или исключение). Выберите другое время или отметьте «записать всё равно».'
      case 'BOOKING_NOT_ACTIVE':
        return 'Запись уже отменена или завершена, менять её нельзя.'
      case 'SERVICE_UNAVAILABLE':
        return 'Барбер не оказывает одну из выбранных услуг. Выберите другие услуги.'
      case 'NOT_FOUND':
        return 'Запись не найдена. Возможно, её уже удалили.'
      case 'VALIDATION_ERROR':
        return 'Проверьте данные и попробуйте ещё раз.'
      default:
        return errorMessage(error)
    }
  }
  return errorMessage(error)
}
