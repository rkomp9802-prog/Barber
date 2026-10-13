import {
  ANY_BARBER,
  selectedServices,
  tashkentDateKey,
  totalDurationMin,
  totalPrice,
  type BarberChoice,
  type BookingDto,
  type SlotTime,
} from '@barber/shared'

import { tashkentTime } from '@/lib/datetime'

import type { BookingState } from './bookingState'
import type { BookingCatalog } from './types'

export type SummaryService = {
  id: string
  name: string
  price: number
}

export type BookingSummary = {
  services: SummaryService[]
  barberName: string | undefined
  dateKey: string | null
  time: SlotTime | null
  durationMin: number
  price: number
}

export function barberDisplayName(catalog: BookingCatalog, barber: BarberChoice | null): string | undefined {
  if (barber === null) return undefined
  if (barber === ANY_BARBER) return 'Любой свободный'
  return catalog.barbers.find(candidate => candidate.id === barber)?.name
}

type SummarySource = Pick<BookingState, 'catalog' | 'serviceIds' | 'barber' | 'dateKey' | 'slot'>

/** Данные для панели «Ваша запись»: что выбрано и сколько это стоит. */
export function bookingSummary(state: SummarySource): BookingSummary {
  const chosen = selectedServices(state.catalog.services, state.serviceIds)
  return {
    services: chosen,
    barberName: barberDisplayName(state.catalog, state.barber),
    dateKey: state.dateKey,
    time: state.slot?.time ?? null,
    durationMin: totalDurationMin(chosen),
    price: totalPrice(chosen),
  }
}

/** Сводка по записи, которую вернул сервер: цены и мастер — уже окончательные. */
export function summaryFromBooking(booking: BookingDto): BookingSummary {
  const startsAt = new Date(booking.startsAt)
  return {
    services: booking.services.map(service => ({ id: service.serviceId, name: service.name, price: service.price })),
    barberName: booking.barber.name,
    dateKey: tashkentDateKey(startsAt),
    time: tashkentTime(startsAt),
    durationMin: booking.totalDurationMin,
    price: booking.totalPrice,
  }
}
