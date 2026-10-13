import { formatDuration, formatLongDate, formatPrice, type BookingDto } from '@barber/shared'

import styles from './Manage.module.css'
import { BOOKING_STATUS_LABELS, bookingClock, bookingCode, bookingDateKey, statusTone } from './manageRules'

type Props = {
  booking: BookingDto
}

const TONE_CLASS = {
  active: styles.statusActive,
  done: styles.statusDone,
  closed: '',
} as const

/** Карточка с деталями записи: статус, дата и время, мастер, услуги и итог. */
export function BookingDetails({ booking }: Props) {
  return (
    <section className={styles.card} aria-labelledby="booking-title">
      <p className="eyebrow">Запись № {bookingCode(booking.id)}</p>
      <h1 id="booking-title" className={styles.title}>
        Ваша запись
      </h1>
      <span className={`${styles.status} ${TONE_CLASS[statusTone(booking.status)]}`}>
        {BOOKING_STATUS_LABELS[booking.status]}
      </span>

      <dl className={styles.facts}>
        <div>
          <dt>Дата</dt>
          <dd>{formatLongDate(bookingDateKey(booking.startsAt))}</dd>
        </div>
        <div>
          <dt>Время</dt>
          <dd>
            {bookingClock(booking.startsAt)}–{bookingClock(booking.endsAt)}
          </dd>
        </div>
        <div>
          <dt>Мастер</dt>
          <dd>{booking.barber.name}</dd>
        </div>
        <div>
          <dt>Услуги</dt>
          <dd>
            <ul className={styles.services}>
              {booking.services.map(service => (
                <li key={service.serviceId}>
                  <span>{service.name}</span>
                  <span className={styles.muted}>{formatPrice(service.price)}</span>
                </li>
              ))}
            </ul>
          </dd>
        </div>
      </dl>

      <div className={styles.totals}>
        <span className={styles.muted}>{formatDuration(booking.totalDurationMin)}</span>
        <span className={styles.totalPrice}>{formatPrice(booking.totalPrice)}</span>
      </div>
    </section>
  )
}
