'use client'

import { useState } from 'react'

import type { BookingDto } from '@barber/shared'

import { cancelBooking } from '@/lib/api'
import { errorMessage } from '@/lib/apiErrors'

import styles from './Manage.module.css'

type Props = {
  token: string
  onDone: (booking: BookingDto) => void
  onBack: () => void
}

/** Второй шаг отмены: явное подтверждение, потому что отмену не откатить. */
export function CancelPanel({ token, onDone, onBack }: Props) {
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function confirm() {
    if (isPending) return
    setIsPending(true)
    setError(null)
    try {
      onDone(await cancelBooking(token))
    } catch (failure: unknown) {
      setError(errorMessage(failure))
      setIsPending(false)
    }
  }

  return (
    <section className={styles.panel} aria-labelledby="cancel-title">
      <h2 id="cancel-title" className={styles.panelTitle}>
        Отменить запись?
      </h2>
      <p className="muted">Время освободится для других клиентов. Вернуть запись будет нельзя.</p>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <div className={styles.actions}>
        <button type="button" className="btn btn-ghost" onClick={onBack} disabled={isPending}>
          Не отменять
        </button>
        <button
          type="button"
          className={`btn ${styles.btnDanger}`}
          onClick={() => void confirm()}
          disabled={isPending}
          aria-busy={isPending}
        >
          {isPending && <span className={styles.spinner} aria-hidden="true" />}
          {isPending ? 'Отменяем…' : 'Да, отменить'}
        </button>
      </div>
    </section>
  )
}
