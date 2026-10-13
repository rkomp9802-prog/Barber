import { type BookingDto, formatDuration, formatLongDate, formatPrice } from '@barber/shared'

import { bookingDateKey, formatTashkentTime, STATUS_LABELS } from '../bookings'
import { CUTOFF_HINT } from '../errors'

type Props = {
  booking: BookingDto
  isUpcoming: boolean
  isBusy: boolean
  onCancel: (booking: BookingDto) => void
  onReschedule: (booking: BookingDto) => void
}

export function BookingCard({ booking, isUpcoming, isBusy, onCancel, onReschedule }: Props) {
  const status = STATUS_LABELS[booking.status]
  const when = `${formatLongDate(bookingDateKey(booking.startsAt))}, ${formatTashkentTime(booking.startsAt)}`
  const hintId = `cutoff-${booking.id}`
  const isLocked = !booking.canChange

  return (
    <article className={`booking-card${isUpcoming ? '' : ' is-past'}`} aria-busy={isBusy || undefined}>
      <div className="booking-head">
        <p className="booking-when">{when}</p>
        <span className={`badge badge-${status.tone}`}>{status.label}</span>
      </div>
      <p className="booking-services">{booking.services.map(service => service.name).join(', ')}</p>
      <p className="muted">
        {booking.barber.name} · {formatDuration(booking.totalDurationMin)} · {formatPrice(booking.totalPrice)}
      </p>
      {isUpcoming && (
        <>
          <div className="booking-actions">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={isLocked || isBusy}
              aria-describedby={isLocked ? hintId : undefined}
              onClick={() => onReschedule(booking)}
            >
              Перенести
            </button>
            <button
              type="button"
              className="btn btn-danger"
              disabled={isLocked || isBusy}
              aria-describedby={isLocked ? hintId : undefined}
              onClick={() => onCancel(booking)}
            >
              {isBusy ? 'Отменяем…' : 'Отменить'}
            </button>
          </div>
          {isLocked && (
            <p id={hintId} className="field-hint">
              {CUTOFF_HINT}
            </p>
          )}
        </>
      )}
    </article>
  )
}
