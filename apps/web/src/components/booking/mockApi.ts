import {
  ANY_BARBER,
  TIMEZONE,
  isValidUzPhone,
  selectedServices,
  tashkentDateKey,
  totalDurationMin,
  totalPrice,
  validateClientName,
  weekdayOf,
  toE164UzPhone,
  type BarberChoice,
  type BookingDto,
  type SlotTime,
} from '@barber/shared'

import { MOCK_BARBER_IDS, barbers, services } from '@/data/mock'
import { isAbortError } from '@/lib/api'

import { qualifyingBarbers } from './bookingState'
import type { BookingDraft } from './types'

/*
 * Демо-режим: «сервер» живёт прямо в браузере. Используется, когда настоящий API недоступен
 * (этапы 1–3 или упавший backend). Задержки имитируют сеть, правила детерминированы,
 * чтобы все состояния UI можно было увидеть руками. Запись нигде не сохраняется.
 */

export const MOCK_DELAY_MS = 600
/** Тестовые свободные слоты из tasks-final.md, этап 2. */
export const BASE_SLOTS: readonly SlotTime[] = ['10:00', '11:00', '12:00', '14:00', '15:00']

const MINUTES_IN_HOUR = 60
const SUNDAY = 0
/** Часы работы как в shop.hours: Пн–Сб 10:00–21:00, Вс 11:00–19:00 (минуты от полуночи). */
const WEEKDAY_HOURS = { open: 10 * MINUTES_IN_HOUR, close: 21 * MINUTES_IN_HOUR }
const SUNDAY_HOURS = { open: 11 * MINUTES_IN_HOUR, close: 19 * MINUTES_IN_HOUR }
/** Выходные барберов по дням недели: Данияр не работает по воскресеньям. */
const DAYS_OFF: Readonly<Record<string, readonly number[]>> = { [MOCK_BARBER_IDS.daniyar]: [SUNDAY] }

export const SLOTS_ERROR_MESSAGE = 'Не удалось загрузить свободное время. Проверьте соединение и попробуйте ещё раз.'

export type SlotsQuery = {
  barber: BarberChoice
  serviceIds: readonly string[]
  dateKey: string
  durationMin: number
}

type RequestOptions = {
  signal?: AbortSignal
  delayMs?: number
  now?: Date
  /** ?demo=error: запрос всегда падает, чтобы показать состояние ошибки. */
  fail?: boolean
}

export function toMinutes(time: SlotTime): number {
  const [hours = 0, minutes = 0] = time.split(':').map(Number)
  return hours * MINUTES_IN_HOUR + minutes
}

/** Минуты от полуночи по Ташкенту. */
export function tashkentMinutesNow(now: Date): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const read = (type: 'hour' | 'minute') => Number(parts.find(part => part.type === type)?.value ?? 0)
  return read('hour') * MINUTES_IN_HOUR + read('minute')
}

function isDayOff(barberId: string, dateKey: string): boolean {
  return DAYS_OFF[barberId]?.includes(weekdayOf(dateKey)) ?? false
}

/** Слоты одного барбера: рабочий день, длительность до закрытия, прошедшее время сегодня. */
export function barberSlots(barberId: string, dateKey: string, durationMin: number, now: Date): SlotTime[] {
  if (isDayOff(barberId, dateKey)) return []
  const hours = weekdayOf(dateKey) === SUNDAY ? SUNDAY_HOURS : WEEKDAY_HOURS
  const isToday = dateKey === tashkentDateKey(now)
  const nowMin = tashkentMinutesNow(now)
  return BASE_SLOTS.filter(slot => {
    const start = toMinutes(slot)
    if (start < hours.open || start + durationMin > hours.close) return false
    return !(isToday && start <= nowMin)
  })
}

function candidateIds(barber: BarberChoice, serviceIds: readonly string[]): string[] {
  const qualifying = qualifyingBarbers(barbers, serviceIds).map(candidate => candidate.id)
  if (barber === ANY_BARBER) return qualifying
  return qualifying.includes(barber) ? [barber] : []
}

/** Синхронный расчёт: для «Любой свободный» — объединение слотов всех подходящих барберов. */
export function computeSlots(query: SlotsQuery, now: Date): SlotTime[] {
  const free = new Set(
    candidateIds(query.barber, query.serviceIds).flatMap(id => barberSlots(id, query.dateKey, query.durationMin, now)),
  )
  return BASE_SLOTS.filter(slot => free.has(slot))
}

function abortError(): DOMException {
  return new DOMException('Запрос отменён', 'AbortError')
}

export { isAbortError }

/** Пауза, которую можно прервать через AbortSignal. */
function wait(delayMs: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError())
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, delayMs)
    function onAbort() {
      clearTimeout(timer)
      reject(abortError())
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

export async function fetchSlots(query: SlotsQuery, options: RequestOptions = {}): Promise<SlotTime[]> {
  await wait(options.delayMs ?? MOCK_DELAY_MS, options.signal)
  if (options.fail) throw new Error(SLOTS_ERROR_MESSAGE)
  return computeSlots(query, options.now ?? new Date())
}

function assertValidDraft(draft: BookingDraft): void {
  if (selectedServices(services, draft.serviceIds).length !== draft.serviceIds.length || draft.serviceIds.length === 0) {
    throw new Error('Выберите хотя бы одну услугу')
  }
  const nameError = validateClientName(draft.name)
  if (nameError) throw new Error(nameError)
  if (!isValidUzPhone(draft.phone)) throw new Error('Проверьте номер телефона')
}

/** «Сервер» выбирает конкретного барбера: первого подходящего, у кого это время свободно. */
function assignBarber(draft: BookingDraft, now: Date): string {
  const durationMin = totalDurationMin(selectedServices(services, draft.serviceIds))
  const assigned = candidateIds(draft.barber, draft.serviceIds).find(id =>
    barberSlots(id, draft.dateKey, durationMin, now).includes(draft.slot.time),
  )
  if (!assigned) throw new Error('Это время уже занято. Выберите другое.')
  return assigned
}

/** Ответ в форме настоящего POST /bookings, чтобы экран успеха не отличался. */
function toDemoBooking(draft: BookingDraft, barberId: string): BookingDto {
  const chosen = selectedServices(services, draft.serviceIds)
  const durationMin = totalDurationMin(chosen)
  const startsAt = new Date(draft.slot.startsAt)
  return {
    id: crypto.randomUUID(),
    status: 'confirmed',
    source: 'web',
    startsAt: startsAt.toISOString(),
    endsAt: new Date(startsAt.getTime() + durationMin * 60_000).toISOString(),
    totalPrice: totalPrice(chosen),
    totalDurationMin: durationMin,
    barber: { id: barberId, name: barbers.find(barber => barber.id === barberId)?.name ?? '' },
    client: { name: draft.name, phone: toE164UzPhone(draft.phone) },
    services: chosen.map(service => ({ serviceId: service.id, name: service.name, durationMin: service.durationMin, price: service.price })),
    manageToken: crypto.randomUUID(),
    canChange: false,
    telegramLink: null,
  }
}

export async function createBooking(draft: BookingDraft, options: RequestOptions = {}): Promise<BookingDto> {
  await wait(options.delayMs ?? MOCK_DELAY_MS, options.signal)
  assertValidDraft(draft)
  return toDemoBooking(draft, assignBarber(draft, options.now ?? new Date()))
}
