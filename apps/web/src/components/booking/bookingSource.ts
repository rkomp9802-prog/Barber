import {
  selectedServices,
  toE164UzPhone,
  totalDurationMin,
  type BarberChoice,
  type BookingDto,
  type CreateBookingInput,
} from '@barber/shared'

import { services as demoServices } from '@/data/mock'
import { createBooking, getAvailability, getAvailabilityDays } from '@/lib/api'
import { tashkentToIso } from '@/lib/datetime'

import * as mock from './mockApi'
import type { BookingDraft, DayOption, SlotOption } from './types'

/*
 * Откуда мастер записи берёт свободные дни/слоты и куда отправляет запись.
 * live — настоящий API; demo — mockApi в браузере (API недоступен).
 * Шаги «Дата» и «Время» знают только этот интерфейс — его же использует перенос записи.
 */

export type AvailabilityQuery = {
  serviceIds: readonly string[]
  barber: BarberChoice
}

export type DaysQuery = AvailabilityQuery & { from: string; days: number }
export type SlotsQuery = AvailabilityQuery & { dateKey: string }

export type BookingSource = {
  fetchDays: (query: DaysQuery, signal: AbortSignal) => Promise<DayOption[]>
  fetchSlots: (query: SlotsQuery, signal: AbortSignal) => Promise<SlotOption[]>
  createBooking: (draft: BookingDraft) => Promise<BookingDto>
}

export type SourceMode = 'live' | 'demo'

/** Черновик → тело POST /bookings: телефон в E.164, начало слота в UTC от сервера. */
export function toCreateBookingInput(draft: BookingDraft): CreateBookingInput {
  return {
    serviceIds: draft.serviceIds,
    barberId: draft.barber,
    startsAt: draft.slot.startsAt,
    client: { name: draft.name, phone: toE164UzPhone(draft.phone) },
  }
}

export const liveSource: BookingSource = {
  async fetchDays({ serviceIds, barber, from, days }, signal) {
    const response = await getAvailabilityDays({ serviceIds, barberId: barber, from, days }, { signal })
    return response.days
  },
  async fetchSlots({ serviceIds, barber, dateKey }, signal) {
    const response = await getAvailability({ serviceIds, barberId: barber, date: dateKey }, { signal })
    return response.slots
  },
  createBooking: draft => createBooking(toCreateBookingInput(draft)),
}

function demoQuery(query: SlotsQuery): mock.SlotsQuery {
  const durationMin = totalDurationMin(selectedServices(demoServices, query.serviceIds))
  return { barber: query.barber, serviceIds: query.serviceIds, dateKey: query.dateKey, durationMin }
}

function addDays(dateKey: string, offset: number): string {
  const date = new Date(`${dateKey}T12:00:00Z`)
  return new Date(date.getTime() + offset * 86_400_000).toISOString().slice(0, 10)
}

export const demoSource: BookingSource = {
  async fetchDays({ from, days, ...query }, signal) {
    const dates = Array.from({ length: days }, (_, i) => addDays(from, i))
    await mock.fetchSlots(demoQuery({ ...query, dateKey: from }), { signal, delayMs: mock.MOCK_DELAY_MS / 2 })
    const now = new Date()
    return dates.map(date => ({ date, hasSlots: mock.computeSlots(demoQuery({ ...query, dateKey: date }), now).length > 0 }))
  },
  async fetchSlots(query, signal) {
    const times = await mock.fetchSlots(demoQuery(query), { signal })
    return times.map(time => ({ time, startsAt: tashkentToIso(query.dateKey, time), barberIds: [] }))
  },
  createBooking: draft => mock.createBooking(draft),
}

/** ?demo=error: загрузка слотов всегда падает, чтобы увидеть состояние ошибки. */
export function withFailingSlots(source: BookingSource): BookingSource {
  return {
    ...source,
    async fetchSlots(query, signal) {
      await mock.fetchSlots(demoQuery(query), { signal, fail: true })
      return []
    },
  }
}

export function pickSource(mode: SourceMode, isDemoError: boolean): BookingSource {
  const base = mode === 'live' ? liveSource : demoSource
  return isDemoError ? withFailingSlots(base) : base
}
