'use client'

import { useState, type FormEvent } from 'react'

import Link from 'next/link'

import {
  formatDuration,
  formatPrice,
  formatUzPhone,
  tashkentDateKey,
  type AdminBookingDto,
  type AdminBookingUpdateInput,
} from '@barber/shared'

import { getBooking, updateBooking } from '@/lib/adminApi'
import {
  adminBookingErrorMessage,
  buildRescheduleInput,
  buildStatusInput,
  canMarkAfterStart,
  isBookingActive,
  isoToTashkentParts,
} from '@/lib/admin/bookingForm'
import { formatTashkentDay, formatTashkentTime } from '@/lib/admin/datetime'
import { toBookingView } from '@/lib/admin/bookingView'
import { useAsyncData } from '@/lib/admin/useAsyncData'

import { AsyncContent } from '../StateBlocks'
import { BookingStatusBadge } from './BookingStatusBadge'
import styles from './bookingEditor.module.css'
import listStyles from './bookings.module.css'

type Props = {
  bookingId: string
}

/** Загружает запись и показывает карточку; при смене id карточка пересоздаётся. */
export function BookingDetail({ bookingId }: Props) {
  const { state, reload } = useAsyncData(() => getBooking(bookingId), [bookingId])

  return (
    <AsyncContent state={state} onRetry={reload}>
      {booking => <BookingPanel key={booking.id} initial={booking} />}
    </AsyncContent>
  )
}

type Panel = 'none' | 'reschedule' | 'cancel'

function BookingPanel({ initial }: { initial: AdminBookingDto }) {
  const [booking, setBooking] = useState(initial)
  const [panel, setPanel] = useState<Panel>('none')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const view = toBookingView(booking)
  const active = isBookingActive(booking.status)
  const started = canMarkAfterStart(booking.startsAt)
  const startParts = isoToTashkentParts(booking.startsAt)

  /** Отправляет PATCH и обновляет карточку ответом сервера; true — успех. */
  async function apply(input: AdminBookingUpdateInput, done: string): Promise<boolean> {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const updated = await updateBooking(booking.id, input)
      setBooking(updated)
      setPanel('none')
      setNotice(done)
      return true
    } catch (caught: unknown) {
      setError(adminBookingErrorMessage(caught))
      return false
    } finally {
      setBusy(false)
    }
  }

  function markFinal(status: 'completed' | 'no_show') {
    const done = status === 'completed' ? 'Запись отмечена как завершённая.' : 'Отмечено: клиент не пришёл.'
    void apply(buildStatusInput(status), done)
  }

  function cancel() {
    void apply(buildStatusInput('cancelled'), 'Запись отменена. Клиент и барбер уведомлены.')
  }

  function reschedule(draft: { date: string; time: string; force: boolean }) {
    const result = buildRescheduleInput(draft)
    if ('error' in result) {
      setError(result.error)
      return
    }
    void apply(result.input, 'Запись перенесена. Клиент и барбер уведомлены.')
  }

  return (
    <div className={styles.stack}>
      <div className={styles.topRow}>
        <Link href="/admin/bookings" className={styles.backLink}>
          ← Все записи
        </Link>
      </div>

      <header className={styles.topRow}>
        <h1 className={listStyles.title}>Запись</h1>
        <BookingStatusBadge label={view.statusLabel} tone={view.statusTone} />
      </header>

      {notice ? (
        <p role="status" className={styles.notice}>
          {notice}
        </p>
      ) : null}

      <section className={styles.card} aria-labelledby="booking-client">
        <h2 id="booking-client" className={styles.cardTitle}>
          Клиент и время
        </h2>
        <dl className={`${styles.facts} ${styles.factsWide}`}>
          <div className={styles.fact}>
            <dt>Клиент</dt>
            <dd>{booking.client.name}</dd>
          </div>
          <div className={styles.fact}>
            <dt>Телефон</dt>
            <dd>
              <a href={`tel:${booking.client.phone}`}>{formatUzPhone(booking.client.phone)}</a>
            </dd>
          </div>
          <div className={styles.fact}>
            <dt>Барбер</dt>
            <dd>{booking.barber.name}</dd>
          </div>
          <div className={styles.fact}>
            <dt>Время (Ташкент)</dt>
            <dd>
              {view.day}, {view.timeRange}
            </dd>
          </div>
          <div className={styles.fact}>
            <dt>Длительность</dt>
            <dd>{formatDuration(booking.totalDurationMin)}</dd>
          </div>
          <div className={styles.fact}>
            <dt>Источник</dt>
            <dd>{view.sourceLabel}</dd>
          </div>
          <div className={styles.fact}>
            <dt>Создана</dt>
            <dd>
              {formatTashkentDay(booking.createdAt)}, {formatTashkentTime(booking.createdAt)}
            </dd>
          </div>
        </dl>
      </section>

      <section className={styles.card} aria-labelledby="booking-services">
        <h2 id="booking-services" className={styles.cardTitle}>
          Услуги
        </h2>
        <ul className={styles.serviceList}>
          {booking.services.map(service => (
            <li key={service.serviceId} className={styles.serviceItem}>
              <span>
                {service.name} <span className={styles.muted}>· {formatDuration(service.durationMin)}</span>
              </span>
              <span className={styles.total}>{formatPrice(service.price)}</span>
            </li>
          ))}
        </ul>
        <div className={styles.serviceItem}>
          <span>Итого</span>
          <span className={styles.total}>{formatPrice(booking.totalPrice)}</span>
        </div>
      </section>

      <section className={styles.card} aria-labelledby="booking-actions">
        <h2 id="booking-actions" className={styles.cardTitle}>
          Действия
        </h2>

        {!active ? (
          <p className={styles.muted}>Запись в статусе «{view.statusLabel}», менять её нельзя.</p>
        ) : null}

        {error ? (
          <p role="alert" className={styles.alert}>
            {error}
          </p>
        ) : null}

        {active && panel === 'none' ? (
          <div className={styles.stack}>
            <div className={styles.actions}>
              <button type="button" className="btn btn-primary" disabled={busy || !started} onClick={() => markFinal('completed')}>
                Завершена
              </button>
              <button type="button" className="btn btn-ghost" disabled={busy || !started} onClick={() => markFinal('no_show')}>
                Не пришёл
              </button>
              <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setPanel('reschedule')}>
                Перенести
              </button>
              <button type="button" className={`btn ${styles.btnDanger}`} disabled={busy} onClick={() => setPanel('cancel')}>
                Отменить запись
              </button>
            </div>
            {!started ? (
              <p className={styles.hint}>Отметить завершение или неявку можно после начала записи.</p>
            ) : null}
          </div>
        ) : null}

        {active && panel === 'cancel' ? (
          <div className={styles.panel} role="group" aria-label="Подтверждение отмены">
            <p className={styles.panelText}>
              Отменить запись клиента {booking.client.name} на {view.day}, {view.timeRange}? Клиент и барбер получат
              уведомление.
            </p>
            <div className={styles.actions}>
              <button type="button" className={`btn ${styles.btnDanger}`} disabled={busy} onClick={cancel}>
                Да, отменить запись
              </button>
              <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setPanel('none')}>
                Не отменять
              </button>
            </div>
          </div>
        ) : null}

        {active && panel === 'reschedule' ? (
          <RescheduleForm
            initialDate={startParts.date}
            initialTime={startParts.time}
            busy={busy}
            onSubmit={reschedule}
            onCancel={() => setPanel('none')}
          />
        ) : null}
      </section>
    </div>
  )
}

type RescheduleFormProps = {
  initialDate: string
  initialTime: string
  busy: boolean
  onSubmit: (draft: { date: string; time: string; force: boolean }) => void
  onCancel: () => void
}

function RescheduleForm({ initialDate, initialTime, busy, onSubmit, onCancel }: RescheduleFormProps) {
  const [date, setDate] = useState(initialDate)
  const [time, setTime] = useState(initialTime)
  const [force, setForce] = useState(false)
  const today = tashkentDateKey(new Date())

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSubmit({ date, time, force })
  }

  return (
    <form className={styles.panel} onSubmit={handleSubmit} aria-label="Перенос записи">
      <p className={styles.panelText}>Новая дата и время (по Ташкенту)</p>
      <div className={styles.fields}>
        <label className={styles.field}>
          <span>Дата</span>
          <input type="date" required min={today} value={date} onChange={event => setDate(event.target.value)} />
        </label>
        <label className={styles.field}>
          <span>Время</span>
          <input type="time" required value={time} onChange={event => setTime(event.target.value)} />
        </label>
      </div>
      <label className={styles.checkRow}>
        <input type="checkbox" checked={force} onChange={event => setForce(event.target.checked)} />
        Записать всё равно (вне графика, обеда или исключения)
      </label>
      <p className={styles.hint}>Пересечение с другой записью запрещено в любом случае.</p>
      <div className={styles.actions}>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          Перенести
        </button>
        <button type="button" className="btn btn-ghost" disabled={busy} onClick={onCancel}>
          Назад
        </button>
      </div>
    </form>
  )
}
