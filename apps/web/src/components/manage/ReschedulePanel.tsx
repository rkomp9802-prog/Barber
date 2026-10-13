'use client'

import { useRef, useState } from 'react'

import { formatLongDate, nextDateKeys, type BookingDto } from '@barber/shared'

import { DateStep } from '@/components/booking/DateStep'
import { liveSource } from '@/components/booking/bookingSource'
import { TimeStep } from '@/components/booking/TimeStep'
import type { SelectedSlot } from '@/components/booking/types'
import { useDays } from '@/components/booking/useAvailability'
import { isApiRequestError, rescheduleBooking } from '@/lib/api'
import { errorMessage } from '@/lib/apiErrors'

import styles from './Manage.module.css'
import { bookingClock, bookingDateKey } from './manageRules'

const DAYS_AHEAD = 14

type SlotsProps = {
  booking: BookingDto
  todayKey: string
  dateKey: string
  slot: SelectedSlot | null
  refreshKey: number
  onSelectDate: (dateKey: string) => void
  onSelectSlot: (slot: SelectedSlot) => void
}

/** Выбор дня и времени: те же шаги, что в мастере записи, с теми же услугами и мастером. */
function RescheduleSlots({ booking, todayKey, dateKey, slot, refreshKey, onSelectDate, onSelectSlot }: SlotsProps) {
  const serviceIds = booking.services.map(service => service.serviceId)
  const barber = booking.barber.id
  const dateKeys = nextDateKeys(new Date(`${todayKey}T12:00:00Z`), DAYS_AHEAD)
  const days = useDays(liveSource, { serviceIds, barber, from: todayKey, days: DAYS_AHEAD })
  const dateSectionRef = useRef<HTMLDivElement>(null)

  return (
    <div ref={dateSectionRef} className={styles.group}>
      <DateStep dateKeys={dateKeys} todayKey={todayKey} selected={dateKey} days={days.state} onSelect={onSelectDate} />
      <TimeStep
        source={liveSource}
        barber={barber}
        serviceIds={serviceIds}
        dateKey={dateKey}
        dateKeys={dateKeys}
        selected={slot}
        refreshKey={refreshKey}
        onSelect={onSelectSlot}
        onSelectDate={onSelectDate}
        onPickAnotherDay={() => dateSectionRef.current?.scrollIntoView({ block: 'center' })}
      />
    </div>
  )
}

type Props = {
  booking: BookingDto
  todayKey: string
  onDone: (booking: BookingDto) => void
  onBack: () => void
}

/** Перенос: тот же мастер и те же услуги, выбираем новое время. */
export function ReschedulePanel({ booking, todayKey, onDone, onBack }: Props) {
  const [dateKey, setDateKey] = useState(() => bookingDateKey(booking.startsAt))
  const [slot, setSlot] = useState<SelectedSlot | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleSelectDate(nextDateKey: string) {
    setDateKey(nextDateKey)
    setSlot(null)
  }

  async function confirm() {
    if (!slot || isPending) return
    setIsPending(true)
    setError(null)
    try {
      onDone(await rescheduleBooking(booking.manageToken, slot.startsAt))
    } catch (failure: unknown) {
      setIsPending(false)
      setError(errorMessage(failure))
      if (isApiRequestError(failure, 'SLOT_TAKEN')) {
        setSlot(null)
        setRefreshKey(count => count + 1)
      }
    }
  }

  return (
    <section className={styles.panel} aria-labelledby="reschedule-title">
      <h2 id="reschedule-title" className={styles.panelTitle}>
        Новое время
      </h2>
      <RescheduleSlots
        booking={booking}
        todayKey={todayKey}
        dateKey={dateKey}
        slot={slot}
        refreshKey={refreshKey}
        onSelectDate={handleSelectDate}
        onSelectSlot={setSlot}
      />
      <p className="muted" aria-live="polite">
        {slot ? `Перенесём на ${formatLongDate(dateKey)}, ${bookingClock(slot.startsAt)}` : 'Выберите день и время.'}
      </p>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <div className={styles.actions}>
        <button type="button" className="btn btn-ghost" onClick={onBack} disabled={isPending}>
          Назад
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void confirm()}
          disabled={!slot || isPending}
          aria-busy={isPending}
        >
          {isPending && <span className={styles.spinner} aria-hidden="true" />}
          {isPending ? 'Переносим…' : 'Перенести на это время'}
        </button>
      </div>
    </section>
  )
}
