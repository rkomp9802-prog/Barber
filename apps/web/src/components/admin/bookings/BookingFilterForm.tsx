'use client'

import { useEffect, useState, type FormEvent } from 'react'

import { listBarbers } from '@/lib/adminApi'
import {
  EMPTY_BOOKING_FILTERS,
  hasActiveBookingFilters,
  type BookingFilters,
} from '@/lib/admin/bookingsQuery'
import { BOOKING_SOURCE_LABELS, BOOKING_STATUS_LABELS } from '@/lib/admin/labels'
import { useAsyncData } from '@/lib/admin/useAsyncData'
import { BOOKING_SOURCES, BOOKING_STATUSES, type BookingSource, type BookingStatus } from '@barber/shared'

import styles from './bookings.module.css'

type Props = {
  filters: BookingFilters
  onChange: (next: BookingFilters) => void
}

export function BookingFilterForm({ filters, onChange }: Props) {
  const barbers = useAsyncData(listBarbers, [])
  const [searchDraft, setSearchDraft] = useState(filters.search)

  // Сброс фильтров снаружи должен очищать и поле поиска.
  useEffect(() => {
    setSearchDraft(filters.search)
  }, [filters.search])

  function update<K extends keyof BookingFilters>(key: K, value: BookingFilters[K]) {
    onChange({ ...filters, [key]: value })
  }

  function commitSearch() {
    if (searchDraft.trim() !== filters.search.trim()) update('search', searchDraft.trim())
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    commitSearch()
  }

  const barberOptions = barbers.state.status === 'ready' ? barbers.state.data : []

  return (
    <form className={styles.filters} onSubmit={handleSubmit} role="search" aria-label="Фильтры записей">
      <label className={styles.field}>
        <span>С даты</span>
        <input type="date" value={filters.from} onChange={event => update('from', event.target.value)} />
      </label>
      <label className={styles.field}>
        <span>По дату</span>
        <input type="date" value={filters.to} onChange={event => update('to', event.target.value)} />
      </label>
      <label className={styles.field}>
        <span>Барбер</span>
        <select
          value={filters.barberId}
          disabled={barbers.state.status !== 'ready'}
          onChange={event => update('barberId', event.target.value)}
        >
          <option value="">Все барберы</option>
          {barberOptions.map(barber => (
            <option key={barber.id} value={barber.id}>
              {barber.name}
              {barber.isActive ? '' : ' (скрыт)'}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.field}>
        <span>Статус</span>
        <select value={filters.status} onChange={event => update('status', event.target.value as BookingStatus | '')}>
          <option value="">Все статусы</option>
          {BOOKING_STATUSES.map(status => (
            <option key={status} value={status}>
              {BOOKING_STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.field}>
        <span>Источник</span>
        <select value={filters.source} onChange={event => update('source', event.target.value as BookingSource | '')}>
          <option value="">Все источники</option>
          {BOOKING_SOURCES.map(source => (
            <option key={source} value={source}>
              {BOOKING_SOURCE_LABELS[source]}
            </option>
          ))}
        </select>
      </label>
      <label className={`${styles.field} ${styles.fieldWide}`}>
        <span>Имя или телефон</span>
        <input
          type="search"
          maxLength={60}
          value={searchDraft}
          placeholder="Например, Иван или 901234567"
          onChange={event => setSearchDraft(event.target.value)}
          onBlur={commitSearch}
        />
      </label>
      <div className={styles.filterActions}>
        <button type="submit" className="btn btn-ghost">
          Найти
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={!hasActiveBookingFilters(filters)}
          onClick={() => onChange(EMPTY_BOOKING_FILTERS)}
        >
          Сбросить
        </button>
      </div>
    </form>
  )
}
