import { type BookingDto, formatLongDate, formatPrice } from '@barber/shared'

import { bookingDateKey, formatTashkentTime } from '../bookings'
import { SummaryList } from './SummaryList'

type Props = {
  booking: BookingDto
  onMyBookings: () => void
}

export function SuccessView({ booking, onMyBookings }: Props) {
  const items = [
    { label: 'Когда', value: `${formatLongDate(bookingDateKey(booking.startsAt))}, ${formatTashkentTime(booking.startsAt)}` },
    { label: 'Барбер', value: booking.barber.name },
    { label: 'Услуги', value: booking.services.map(service => service.name).join(', ') },
    { label: 'Стоимость', value: formatPrice(booking.totalPrice) },
  ]
  return (
    <div className="success" role="status" aria-live="polite">
      <div className="success-icon" aria-hidden="true">
        ✓
      </div>
      <p className="success-text">Мы ждём вас! Напоминание придёт в Telegram.</p>
      <SummaryList items={items} />
      <button type="button" className="btn btn-secondary btn-block" onClick={onMyBookings}>
        Мои записи
      </button>
    </div>
  )
}
