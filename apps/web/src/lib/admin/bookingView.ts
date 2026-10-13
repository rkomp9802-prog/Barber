import { formatPrice, type AdminBookingDto } from '@barber/shared'

import { formatTashkentDay, formatTashkentTime } from './datetime'
import { bookingSourceLabel, bookingStatusLabel, BOOKING_STATUS_TONES, type StatusTone } from './labels'

/** Готовые к выводу поля строки/карточки записи. */
export type BookingView = {
  id: string
  day: string
  timeRange: string
  clientName: string
  clientPhone: string
  barberName: string
  servicesText: string
  total: string
  statusLabel: string
  statusTone: StatusTone
  sourceLabel: string
}

export function toBookingView(booking: AdminBookingDto): BookingView {
  return {
    id: booking.id,
    day: formatTashkentDay(booking.startsAt),
    timeRange: `${formatTashkentTime(booking.startsAt)}–${formatTashkentTime(booking.endsAt)}`,
    clientName: booking.client.name,
    clientPhone: booking.client.phone,
    barberName: booking.barber.name,
    servicesText: booking.services.map(service => service.name).join(', '),
    total: formatPrice(booking.totalPrice),
    statusLabel: bookingStatusLabel(booking.status),
    statusTone: BOOKING_STATUS_TONES[booking.status],
    sourceLabel: bookingSourceLabel(booking.source),
  }
}
