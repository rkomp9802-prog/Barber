'use client'

import { RATING_VALUES, VISIBILITY_LABELS, EMPTY_REVIEW_FILTERS, hasActiveReviewFilters, type ReviewFilters, type ReviewVisibility } from '@/lib/admin/reviews'
import type { AdminBarberDto } from '@barber/shared'
import type { AsyncState } from '@/lib/admin/useAsyncData'

import styles from './reviews.module.css'

type Props = {
  filters: ReviewFilters
  onChange: (next: ReviewFilters) => void
  barbers: AsyncState<AdminBarberDto[]>
}

/** Фильтры применяются сразу при изменении поля. */
export function ReviewFilterForm({ filters, onChange, barbers }: Props) {
  function update<K extends keyof ReviewFilters>(key: K, value: ReviewFilters[K]) {
    onChange({ ...filters, [key]: value })
  }

  const barberOptions = barbers.status === 'ready' ? barbers.data : []

  return (
    <form className={styles.filters} role="search" aria-label="Фильтры отзывов" onSubmit={event => event.preventDefault()}>
      <label className={styles.field}>
        <span>Барбер</span>
        <select
          value={filters.barberId}
          disabled={barbers.status !== 'ready'}
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
        {barbers.status === 'error' ? <small className={styles.error}>Не удалось загрузить барберов: {barbers.message}</small> : null}
      </label>

      <label className={styles.field}>
        <span>Показ на сайте</span>
        <select
          value={filters.visibility}
          onChange={event => update('visibility', event.target.value as ReviewVisibility)}
        >
          {(Object.keys(VISIBILITY_LABELS) as ReviewVisibility[]).map(value => (
            <option key={value || 'all'} value={value}>
              {VISIBILITY_LABELS[value]}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.field}>
        <span>Рейтинг от</span>
        <select value={filters.minRating} onChange={event => update('minRating', event.target.value)}>
          <option value="">Любой</option>
          {RATING_VALUES.map(value => (
            <option key={value} value={String(value)}>
              {value}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.field}>
        <span>Рейтинг до</span>
        <select value={filters.maxRating} onChange={event => update('maxRating', event.target.value)}>
          <option value="">Любой</option>
          {RATING_VALUES.map(value => (
            <option key={value} value={String(value)}>
              {value}
            </option>
          ))}
        </select>
      </label>

      <div className={styles.filterActions}>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={!hasActiveReviewFilters(filters)}
          onClick={() => onChange(EMPTY_REVIEW_FILTERS)}
        >
          Сбросить
        </button>
      </div>
    </form>
  )
}
