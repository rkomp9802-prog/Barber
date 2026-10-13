'use client'

import type { AdminBarberDto } from '@barber/shared'

import {
  EMPTY_TIME_OFF_FILTERS,
  hasActiveTimeOffFilters,
  type TimeOffFilters,
} from '@/lib/admin/timeOff'
import type { AsyncState } from '@/lib/admin/useAsyncData'

import styles from './time-off.module.css'

type Props = {
  filters: TimeOffFilters
  onChange: (next: TimeOffFilters) => void
  barbers: AsyncState<AdminBarberDto[]>
}

/** Фильтры применяются сразу при изменении поля. */
export function TimeOffFilterForm({ filters, onChange, barbers }: Props) {
  function update<K extends keyof TimeOffFilters>(key: K, value: TimeOffFilters[K]) {
    onChange({ ...filters, [key]: value })
  }

  const barberOptions = barbers.status === 'ready' ? barbers.data : []

  return (
    <form className={styles.filters} role="search" aria-label="Фильтры исключений" onSubmit={event => event.preventDefault()}>
      <label className={styles.field}>
        <span>С даты</span>
        <input type="date" value={filters.from} onChange={event => update('from', event.target.value)} />
      </label>
      <label className={styles.field}>
        <span>По дату</span>
        <input type="date" value={filters.to} onChange={event => update('to', event.target.value)} />
      </label>
      <label className={`${styles.field} ${styles.fieldWide}`}>
        <span>Барбер</span>
        <select
          value={filters.barberId}
          disabled={barbers.status !== 'ready'}
          onChange={event => update('barberId', event.target.value)}
        >
          <option value="">Все исключения</option>
          <option value="shop">Только весь салон</option>
          {barberOptions.map(barber => (
            <option key={barber.id} value={barber.id}>
              {barber.name}
              {barber.isActive ? '' : ' (скрыт)'}
            </option>
          ))}
        </select>
        {barbers.status === 'error' ? <small className={styles.error}>Не удалось загрузить барберов: {barbers.message}</small> : null}
      </label>
      <div className={styles.filterActions}>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={!hasActiveTimeOffFilters(filters)}
          onClick={() => onChange(EMPTY_TIME_OFF_FILTERS)}
        >
          Сбросить
        </button>
      </div>
    </form>
  )
}
