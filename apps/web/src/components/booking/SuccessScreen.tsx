import { useEffect, useRef } from 'react'

import Link from 'next/link'

import { formatDuration, formatPrice, type BookingDto } from '@barber/shared'

import { bookingCode } from '@/components/manage/manageRules'

import type { BookingSummary } from './bookingSummary'
import { SummaryDetails } from './Summary'
import styles from './Summary.module.css'

type Props = {
  summary: BookingSummary
  booking: BookingDto
  clientName: string
  clientPhone: string
  /** В демо-режиме запись нигде не сохраняется — говорим об этом прямо. */
  isDemo: boolean
  onBookAgain: () => void
}

type TicketMetaProps = {
  summary: BookingSummary
  client: string
}

function TicketMeta({ summary, client }: TicketMetaProps) {
  return (
    <dl className={styles.ticketMeta}>
      <div>
        <dt>Длительность</dt>
        <dd>{formatDuration(summary.durationMin)}</dd>
      </div>
      <div>
        <dt>Итого</dt>
        <dd className={styles.totalPrice}>{formatPrice(summary.price)}</dd>
      </div>
      <div>
        <dt>Клиент</dt>
        <dd>{client}</dd>
      </div>
    </dl>
  )
}

export function SuccessScreen({ summary, booking, clientName, clientPhone, isDemo, onBookAgain }: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true })
    window.scrollTo({ top: 0 })
  }, [])

  return (
    <section className={styles.success} aria-labelledby="success-title">
      <span className={styles.seal} aria-hidden="true">
        ✓
      </span>
      <p className="eyebrow">Запись № {bookingCode(booking.id)}</p>
      <h1 id="success-title" ref={headingRef} tabIndex={-1} className={styles.successTitle}>
        {clientName}, вы записаны
      </h1>
      <p className="muted">Ждём вас в Sharp Barbershop. Приходите за 5 минут до начала.</p>

      <div className={styles.ticket}>
        <SummaryDetails summary={summary} />
        <TicketMeta summary={summary} client={`${clientName}, ${clientPhone}`} />
      </div>

      {isDemo && (
        <p className={styles.demoNote}>
          Это учебная версия: запись пока нигде не сохраняется. Настоящая запись и подтверждение в Telegram появятся
          на следующих этапах.
        </p>
      )}

      <div className={styles.successActions}>
        <Link href="/" className="btn btn-ghost btn-lg">
          На главную
        </Link>
        {!isDemo && (
          <Link href={`/booking/${booking.manageToken}`} className="btn btn-ghost btn-lg">
            Управлять записью
          </Link>
        )}
        <button type="button" className="btn btn-primary btn-lg" onClick={onBookAgain}>
          Записаться ещё
        </button>
      </div>
    </section>
  )
}
