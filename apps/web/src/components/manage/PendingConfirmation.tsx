'use client'

import { useEffect, useRef, useState } from 'react'

import Link from 'next/link'

import { BOOKING_HOLD_MIN, type BookingDto } from '@barber/shared'

import { shop } from '@/data/shop'
import { cancelBooking, getBooking, isAbortError, isApiRequestError } from '@/lib/api'
import { errorMessage } from '@/lib/apiErrors'

import styles from './Manage.module.css'
import { formatCountdown, holdRemainingMs } from './manageRules'

/** Как часто спрашиваем сервер, не подтвердил ли клиент запись в боте. */
const POLL_MS = 3000
const TICK_MS = 1000

type Props = {
  booking: BookingDto
  /** Бот подтвердил запись — показываем подтверждённую. */
  onConfirmed: (booking: BookingDto) => void
}

type Phase = 'waiting' | 'expired' | 'cancelled'

function PhoneHint() {
  return (
    <p className={styles.notice}>
      Нет Telegram? Позвоните нам, и администратор запишет вас:{' '}
      <a className={styles.link} href={shop.phoneHref}>
        {shop.phone}
      </a>
    </p>
  )
}

function Finished({ text }: { text: string }) {
  return (
    <section className={styles.panel} aria-label="Подтверждение записи">
      <p className="muted">{text}</p>
      <div className={styles.actions}>
        <Link href="/book" className="btn btn-primary btn-lg">
          Выбрать время заново
        </Link>
      </div>
    </section>
  )
}

/**
 * Запись с сайта ждёт подтверждения номера в Telegram (BOOKING_HOLD_MIN минут).
 * Клиент открывает бота по ссылке и нажимает «Поделиться номером»; страница сама узнаёт о подтверждении.
 */
export function PendingConfirmation({ booking, onConfirmed }: Props) {
  const [now, setNow] = useState(() => Date.now())
  const [phase, setPhase] = useState<Phase>('waiting')
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const onConfirmedRef = useRef(onConfirmed)
  onConfirmedRef.current = onConfirmed
  const left = holdRemainingMs(booking.holdExpiresAt, now)

  useEffect(() => {
    if (phase !== 'waiting') return
    const id = window.setInterval(() => setNow(Date.now()), TICK_MS)
    return () => window.clearInterval(id)
  }, [phase])

  useEffect(() => {
    if (phase !== 'waiting') return
    const controller = new AbortController()
    const id = window.setInterval(async () => {
      try {
        const fresh = await getBooking(booking.manageToken, { signal: controller.signal })
        if (fresh.status === 'confirmed') onConfirmedRef.current(fresh)
        else if (fresh.status !== 'pending') setPhase('cancelled')
      } catch (error: unknown) {
        // 404 — срок вышел и запись удалена. Сбой сети — просто спросим ещё раз.
        if (isApiRequestError(error, 'NOT_FOUND')) setPhase('expired')
        else if (!isAbortError(error)) return
      }
    }, POLL_MS)
    return () => {
      window.clearInterval(id)
      controller.abort()
    }
  }, [booking.manageToken, phase])

  async function handleCancel() {
    setCancelling(true)
    setCancelError(null)
    try {
      await cancelBooking(booking.manageToken)
      setPhase('cancelled')
    } catch (error: unknown) {
      if (isApiRequestError(error, 'NOT_FOUND')) setPhase('expired')
      else setCancelError(errorMessage(error))
    } finally {
      setCancelling(false)
    }
  }

  if (phase === 'cancelled') return <Finished text="Запись отменена, время освобождено." />
  if (phase === 'expired' || left === 0) {
    return <Finished text="Время на подтверждение истекло, и мы освободили это время для других клиентов." />
  }

  return (
    <section className={styles.panel} aria-label="Подтвердите запись в Telegram">
      <h2 className={styles.panelTitle}>Подтвердите запись в Telegram</h2>
      <p className="muted">
        Мы держим это время {BOOKING_HOLD_MIN} минут. Откройте бота и нажмите «Поделиться номером» — так мы убедимся,
        что номер ваш. Эта страница обновится сама.
      </p>
      <p className={styles.countdown} role="timer" aria-live="off">
        Осталось <strong>{formatCountdown(left)}</strong>
      </p>
      <div className={styles.actions}>
        {booking.telegramLink && (
          <a className="btn btn-primary btn-lg" href={booking.telegramLink} target="_blank" rel="noopener noreferrer">
            Подтвердить в Telegram
          </a>
        )}
        <button
          type="button"
          className={`btn btn-ghost btn-lg ${styles.danger}`}
          onClick={() => void handleCancel()}
          disabled={cancelling}
        >
          {cancelling && <span className={styles.spinner} aria-hidden="true" />}
          Отменить запись
        </button>
      </div>
      {cancelError && (
        <p className={styles.error} role="alert">
          {cancelError}
        </p>
      )}
      <PhoneHint />
    </section>
  )
}
