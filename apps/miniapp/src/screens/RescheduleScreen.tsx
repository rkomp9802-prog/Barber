import { type BookingDto, formatDayMonth, type SlotDto } from '@barber/shared'
import { useState } from 'react'

import { bookingDateKey, formatTashkentTime } from '../bookings'
import { api } from '../client'
import { BottomBar } from '../components/BottomBar'
import { DatePicker } from '../components/DatePicker'
import { Screen } from '../components/Screen'
import { Notice } from '../components/Status'
import { TimePicker } from '../components/TimePicker'
import { errorCode, errorMessage } from '../errors'
import { hapticNotify, hapticSelection } from '../telegram'

type Props = {
  booking: BookingDto
  onDone: (updated: BookingDto) => void
  /** Перенос невозможен (например, CUTOFF_PASSED): вернуться к списку с сообщением. */
  onAbort: (message: string) => void
  onBack: () => void
}

type Step = 'date' | 'time'
const TERMINAL_CODES = new Set(['CUTOFF_PASSED', 'BOOKING_NOT_ACTIVE', 'NOT_FOUND'])

export function RescheduleScreen({ booking, onDone, onAbort, onBack }: Props) {
  const [step, setStep] = useState<Step>('date')
  const [date, setDate] = useState<string | null>(null)
  const [slot, setSlot] = useState<SlotDto | null>(null)
  const [version, setVersion] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const serviceIds = booking.services.map(service => service.serviceId)

  async function submit(chosen: SlotDto): Promise<void> {
    setSubmitting(true)
    setNotice(null)
    try {
      const updated = await api.rescheduleBooking(booking.manageToken, chosen.startsAt)
      hapticNotify('success')
      onDone(updated)
    } catch (error: unknown) {
      hapticNotify('error')
      if (TERMINAL_CODES.has(errorCode(error))) return onAbort(errorMessage(error))
      setNotice(errorMessage(error))
      setSlot(null)
      setVersion(value => value + 1)
    } finally {
      setSubmitting(false)
    }
  }

  const goBack = (): void => {
    setNotice(null)
    if (step === 'time') setStep('date')
    else onBack()
  }
  const action =
    step === 'date'
      ? { text: 'Далее', disabled: date === null, onClick: () => setStep('time') }
      : { text: slot ? `Перенести на ${slot.time}` : 'Выберите время', disabled: slot === null, loading: submitting, onClick: () => slot && void submit(slot) }
  const current = `Сейчас: ${formatDayMonth(bookingDateKey(booking.startsAt))}, ${formatTashkentTime(booking.startsAt)}`

  return (
    <Screen title={step === 'date' ? 'Новая дата' : 'Новое время'} subtitle={current} onBack={goBack} footer={<BottomBar action={action} />}>
      {notice && <Notice onDismiss={() => setNotice(null)}>{notice}</Notice>}
      {step === 'date' && (
        <DatePicker serviceIds={serviceIds} barberId={booking.barber.id} selected={date} onSelect={value => { hapticSelection(); setDate(value); setSlot(null) }} />
      )}
      {step === 'time' && date && (
        <TimePicker serviceIds={serviceIds} barberId={booking.barber.id} date={date} selected={slot} version={version} onSelect={value => { hapticSelection(); setSlot(value) }} />
      )}
    </Screen>
  )
}
