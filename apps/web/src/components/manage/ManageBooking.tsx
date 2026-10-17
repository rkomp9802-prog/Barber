'use client'

import { useState } from 'react'

import Link from 'next/link'

import type { BookingDto } from '@barber/shared'

import { shop } from '@/data/shop'

import { BookingDetails } from './BookingDetails'
import { CancelPanel } from './CancelPanel'
import { PendingConfirmation } from './PendingConfirmation'
import { ReschedulePanel } from './ReschedulePanel'
import styles from './Manage.module.css'
import { canShowActions, isActiveBooking, isPendingBooking, needsPhoneCall } from './manageRules'

type Panel = 'none' | 'cancel' | 'reschedule'

type Props = {
  initialBooking: BookingDto
  todayKey: string
}

type ActionChoiceProps = {
  onReschedule: () => void
  onCancel: () => void
}

function ActionChoice({ onReschedule, onCancel }: ActionChoiceProps) {
  return (
    <div className={styles.actions}>
      <button type="button" className="btn btn-primary btn-lg" onClick={onReschedule}>
        Перенести
      </button>
      <button type="button" className={`btn btn-ghost btn-lg ${styles.danger}`} onClick={onCancel}>
        Отменить запись
      </button>
    </div>
  )
}

/** Запись уже не активна: отменена, завершена или клиент не пришёл. */
function ClosedNotice() {
  return (
    <section className={styles.panel} aria-label="Запись закрыта">
      <p className="muted">Эта запись уже не активна. Хотите записаться снова?</p>
      <div className={styles.actions}>
        <Link href="/book" className="btn btn-primary">
          Записаться
        </Link>
      </div>
    </section>
  )
}

function PhoneNotice() {
  return (
    <p className={styles.notice}>
      Онлайн изменить запись уже нельзя: до визита осталось меньше времени. Позвоните нам:{' '}
      <a className={styles.link} href={shop.phoneHref}>
        {shop.phone}
      </a>
    </p>
  )
}

/** Страница управления записью: детали и действия, которые сервер сейчас разрешает. */
export function ManageBooking({ initialBooking, todayKey }: Props) {
  const [booking, setBooking] = useState(initialBooking)
  const [panel, setPanel] = useState<Panel>('none')
  const showActions = canShowActions(booking)
  const openPanel = showActions ? panel : 'none'

  function handleChanged(updated: BookingDto) {
    setBooking(updated)
    setPanel('none')
  }

  if (isPendingBooking(booking)) {
    return (
      <div className={styles.stack}>
        <BookingDetails booking={booking} />
        <PendingConfirmation booking={booking} onConfirmed={setBooking} />
      </div>
    )
  }

  return (
    <div className={styles.stack}>
      <BookingDetails booking={booking} />

      {openPanel === 'none' && showActions && (
        <ActionChoice onReschedule={() => setPanel('reschedule')} onCancel={() => setPanel('cancel')} />
      )}
      {openPanel === 'cancel' && (
        <CancelPanel token={booking.manageToken} onDone={handleChanged} onBack={() => setPanel('none')} />
      )}
      {openPanel === 'reschedule' && (
        <ReschedulePanel booking={booking} todayKey={todayKey} onDone={handleChanged} onBack={() => setPanel('none')} />
      )}

      {needsPhoneCall(booking) && <PhoneNotice />}
      {!isActiveBooking(booking) && <ClosedNotice />}
      {booking.telegramLink && (
        <a className="btn btn-ghost" href={booking.telegramLink} target="_blank" rel="noopener noreferrer">
          Получать напоминания в Telegram
        </a>
      )}
    </div>
  )
}
