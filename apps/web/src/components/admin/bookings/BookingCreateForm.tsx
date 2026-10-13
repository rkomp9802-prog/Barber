'use client'

import { useRef, useState, type FormEvent } from 'react'

import { formatDuration, formatPrice, tashkentDateKey, type AdminBarberDto, type AdminServiceDto } from '@barber/shared'
import { useRouter } from 'next/navigation'

import { createBooking, listBarbers, listServices } from '@/lib/adminApi'
import {
  adminBookingErrorMessage,
  buildCreateInput,
  maskPhoneInput,
  MANUAL_MAX_SERVICES,
  serviceOptionsFor,
  summarizeServices,
  CLIENT_NAME_MAX,
} from '@/lib/admin/bookingForm'
import { useAsyncData } from '@/lib/admin/useAsyncData'

import { AsyncContent } from '../StateBlocks'
import styles from './bookingEditor.module.css'

type Catalog = {
  barbers: AdminBarberDto[]
  services: AdminServiceDto[]
}

async function loadCatalog(): Promise<Catalog> {
  const [barbers, services] = await Promise.all([listBarbers(), listServices()])
  return { barbers: barbers.filter(barber => barber.isActive), services }
}

/** Ручное создание записи администратором: загружает барберов и услуги, затем показывает форму. */
export function BookingCreateForm() {
  const catalog = useAsyncData(loadCatalog, [])

  return (
    <AsyncContent state={catalog.state} onRetry={catalog.reload}>
      {data => <CreateForm catalog={data} />}
    </AsyncContent>
  )
}

function CreateForm({ catalog }: { catalog: Catalog }) {
  const router = useRouter()
  const [barberId, setBarberId] = useState('')
  const [serviceIds, setServiceIds] = useState<string[]>([])
  const [date, setDate] = useState(() => tashkentDateKey(new Date()))
  const [time, setTime] = useState('')
  const [clientName, setClientName] = useState('')
  const [phone, setPhone] = useState('')
  const [force, setForce] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Защита от двойной отправки: state обновится только после рендера, а два быстрых Enter успеют раньше.
  const submittingRef = useRef(false)

  const barber = catalog.barbers.find(item => item.id === barberId)
  const options = serviceOptionsFor(barber, catalog.services)
  const totals = summarizeServices(options, serviceIds)
  const today = tashkentDateKey(new Date())

  function changeBarber(nextId: string) {
    const nextOptions = serviceOptionsFor(
      catalog.barbers.find(item => item.id === nextId),
      catalog.services,
    )
    // Услуги, которых новый барбер не оказывает, снимаем с выбора.
    setBarberId(nextId)
    setServiceIds(previous => previous.filter(id => nextOptions.some(option => option.id === id)))
  }

  function toggleService(id: string, checked: boolean) {
    setServiceIds(previous => (checked ? [...previous, id] : previous.filter(item => item !== id)))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submittingRef.current) return
    submittingRef.current = true
    const result = buildCreateInput({ barberId, serviceIds, date, time, clientName, phone, force })
    if ('error' in result) {
      submittingRef.current = false
      setError(result.error)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const booking = await createBooking(result.input)
      // После успеха остаёмся в «busy», чтобы форма не мигала до перехода; флаг не сбрасываем.
      router.push(`/admin/bookings/${booking.id}`)
    } catch (caught: unknown) {
      submittingRef.current = false
      setError(adminBookingErrorMessage(caught))
      setBusy(false)
    }
  }

  const serviceLimitReached = serviceIds.length >= MANUAL_MAX_SERVICES

  return (
    <form className={styles.stack} onSubmit={handleSubmit} aria-label="Новая запись" noValidate>
      {error ? (
        <p role="alert" className={styles.alert}>
          {error}
        </p>
      ) : null}

      <section className={styles.card} aria-labelledby="new-barber">
        <h2 id="new-barber" className={styles.cardTitle}>
          Барбер и услуги
        </h2>
        <div className={styles.fields}>
          <label className={styles.field}>
            <span>Барбер</span>
            <select value={barberId} disabled={busy} onChange={event => changeBarber(event.target.value)}>
              <option value="">Выберите барбера</option>
              {catalog.barbers.map(item => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {barberId && options.length === 0 ? (
          <p className={styles.hint}>У этого барбера нет активных услуг. Назначьте их в разделе «Барберы».</p>
        ) : null}

        {options.length > 0 ? (
          <fieldset className={styles.checkList} disabled={busy}>
            <legend>Услуги (до {MANUAL_MAX_SERVICES})</legend>
            {options.map(option => {
              const checked = serviceIds.includes(option.id)
              return (
                <label key={option.id} className={styles.serviceOption}>
                  <span className={styles.serviceOptionLabel}>
                    <span>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!checked && serviceLimitReached}
                        onChange={event => toggleService(option.id, event.target.checked)}
                      />{' '}
                      {option.name}
                    </span>
                    <span className={styles.serviceOptionMeta}>{formatDuration(option.durationMin)}</span>
                  </span>
                  <span className={styles.total}>{formatPrice(option.price)}</span>
                </label>
              )
            })}
          </fieldset>
        ) : null}

        {serviceIds.length > 0 ? (
          <div className={styles.summary}>
            <span>Итого за {formatDuration(totals.durationMin)}</span>
            <span className={styles.total}>{formatPrice(totals.price)}</span>
          </div>
        ) : null}
      </section>

      <section className={styles.card} aria-labelledby="new-time">
        <h2 id="new-time" className={styles.cardTitle}>
          Дата и время (по Ташкенту)
        </h2>
        <div className={styles.fields}>
          <label className={styles.field}>
            <span>Дата</span>
            <input type="date" min={today} value={date} disabled={busy} onChange={event => setDate(event.target.value)} />
          </label>
          <label className={styles.field}>
            <span>Время</span>
            <input type="time" value={time} disabled={busy} onChange={event => setTime(event.target.value)} />
          </label>
        </div>
        <label className={styles.checkRow}>
          <input type="checkbox" checked={force} disabled={busy} onChange={event => setForce(event.target.checked)} />
          Записать всё равно (вне графика, обеда или исключения)
        </label>
        <p className={styles.hint}>Пересечение с другой записью запрещено в любом случае.</p>
      </section>

      <section className={styles.card} aria-labelledby="new-client">
        <h2 id="new-client" className={styles.cardTitle}>
          Клиент
        </h2>
        <div className={styles.fields}>
          <label className={styles.field}>
            <span>Имя</span>
            <input
              type="text"
              autoComplete="off"
              maxLength={CLIENT_NAME_MAX}
              value={clientName}
              disabled={busy}
              onChange={event => setClientName(event.target.value)}
            />
          </label>
          <label className={styles.field}>
            <span>Телефон</span>
            <input
              type="tel"
              inputMode="tel"
              autoComplete="off"
              placeholder="+998 90 123 45 67"
              value={phone}
              disabled={busy}
              onChange={event => setPhone(maskPhoneInput(event.target.value))}
            />
          </label>
        </div>
      </section>

      <div className={styles.actions}>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Создаём…' : 'Создать запись'}
        </button>
        <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => router.push('/admin/bookings')}>
          Отмена
        </button>
      </div>
    </form>
  )
}
