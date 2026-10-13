import { type BookingDto, formatDayMonth } from '@barber/shared'
import { useState } from 'react'

import { bookingDateKey, formatTashkentTime, isUpcoming, replaceBooking, sortBookings } from '../bookings'
import { api } from '../client'
import { BookingCard } from '../components/BookingCard'
import { BottomBar } from '../components/BottomBar'
import { Screen } from '../components/Screen'
import { EmptyState, ErrorState, Notice, Skeleton } from '../components/Status'
import { errorCode, errorMessage } from '../errors'
import { useRequest } from '../hooks/useRequest'
import { confirmAction, hapticNotify, isInsideTelegram } from '../telegram'
import { RescheduleScreen } from './RescheduleScreen'

type Props = {
  onBack: () => void
  onBook: () => void
}

type Message = { tone: 'info' | 'danger'; text: string }

/** Ошибки, после которых список нужно перечитать с сервера. */
const STALE_CODES = new Set(['CUTOFF_PASSED', 'BOOKING_NOT_ACTIVE', 'NOT_FOUND'])

function whenText(booking: BookingDto): string {
  return `${formatDayMonth(bookingDateKey(booking.startsAt))} в ${formatTashkentTime(booking.startsAt)}`
}

function OutsideTelegram({ onBack, onBook }: Props) {
  return (
    <Screen title="Мои записи" onBack={onBack} footer={<BottomBar action={{ text: 'Записаться', onClick: onBook }} />}>
      <EmptyState title="Раздел работает внутри Telegram">
        <p className="muted">
          Откройте приложение через бота барбершопа — так мы узнаем, какие записи ваши. Записаться можно и здесь.
        </p>
      </EmptyState>
    </Screen>
  )
}

export function MyBookings(props: Props) {
  if (!isInsideTelegram()) return <OutsideTelegram {...props} />
  return <MyBookingsList {...props} />
}

function useBookingActions(reload: () => void) {
  const [local, setLocal] = useState<BookingDto[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState<Message | null>(null)

  function refresh(): void {
    setLocal(null)
    reload()
  }

  async function cancel(booking: BookingDto, list: readonly BookingDto[]): Promise<void> {
    if (!(await confirmAction(`Отменить запись на ${whenText(booking)}?`))) return
    setBusyId(booking.id)
    setMessage(null)
    try {
      const updated = await api.cancelBooking(booking.manageToken)
      hapticNotify('success')
      setLocal(replaceBooking(list, updated))
      setMessage({ tone: 'info', text: 'Запись отменена.' })
    } catch (error: unknown) {
      hapticNotify('error')
      setMessage({ tone: 'danger', text: errorMessage(error) })
      if (STALE_CODES.has(errorCode(error))) refresh()
    } finally {
      setBusyId(null)
    }
  }

  return { local, setLocal, busyId, message, setMessage, cancel, refresh }
}

function MyBookingsList({ onBack, onBook }: Props) {
  const request = useRequest('me', signal => api.getMyBookings(signal))
  const actions = useBookingActions(request.reload)
  const [rescheduling, setRescheduling] = useState<BookingDto | null>(null)
  const list = actions.local ?? (request.status === 'success' ? request.data : [])
  const now = new Date()
  const showList = actions.local !== null || request.status === 'success'

  if (rescheduling) {
    const handleDone = (updated: BookingDto): void => {
      actions.setLocal(replaceBooking(list, updated))
      actions.setMessage({ tone: 'info', text: `Запись перенесена на ${whenText(updated)}.` })
      setRescheduling(null)
    }
    const handleAbort = (text: string): void => {
      actions.setMessage({ tone: 'danger', text })
      actions.refresh()
      setRescheduling(null)
    }
    return (
      <RescheduleScreen booking={rescheduling} onBack={() => setRescheduling(null)} onDone={handleDone} onAbort={handleAbort} />
    )
  }

  return (
    <Screen title="Мои записи" onBack={onBack} footer={<BottomBar action={{ text: 'Новая запись', onClick: onBook }} />}>
      <div aria-live="polite">
        {actions.message && (
          <Notice tone={actions.message.tone} onDismiss={() => actions.setMessage(null)}>
            {actions.message.text}
          </Notice>
        )}
      </div>
      {!showList && request.status === 'loading' && <Skeleton rows={3} label="Загружаем записи…" />}
      {!showList && request.status === 'error' && <ErrorState error={request.error} onRetry={request.reload} />}
      {showList && list.length === 0 && <EmptyState title="У вас пока нет записей" />}
      <div className="booking-list">
        {sortBookings(list, now).map(booking => (
          <BookingCard
            key={booking.id}
            booking={booking}
            isUpcoming={isUpcoming(booking, now)}
            isBusy={actions.busyId === booking.id}
            onCancel={target => void actions.cancel(target, list)}
            onReschedule={setRescheduling}
          />
        ))}
      </div>
    </Screen>
  )
}
