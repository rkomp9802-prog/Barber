'use client'

import type { AdminReviewDto } from '@barber/shared'

import { publicToggleLabel, ratingLabel, ratingStars } from '@/lib/admin/reviews'
import { formatTashkentDay, formatTashkentTime } from '@/lib/admin/datetime'

import styles from './reviews.module.css'

type Props = {
  reviews: readonly AdminReviewDto[]
  /** Уже сохранённые переключения видимости по id отзыва. */
  overrides: Readonly<Record<string, boolean>>
  togglingId: string | null
  onToggle: (review: AdminReviewDto, isPublic: boolean) => void
}

/** Строки на широком экране, карточки на узком — одна разметка на основе сетки. */
export function ReviewsList({ reviews, overrides, togglingId, onToggle }: Props) {
  return (
    <ul className={styles.list} aria-label="Список отзывов">
      {reviews.map(review => {
        const isPublic = overrides[review.id] ?? review.isPublic
        const busy = togglingId === review.id
        return (
          <li key={review.id} className={styles.item}>
            <div className={styles.meta}>
              <span className={styles.strong}>{review.client.name}</span>
              <span className="muted">{review.client.phone}</span>
            </div>
            <div className={styles.meta}>
              <span>
                {review.barber.name}
              </span>
              <span className="muted">
                визит {formatTashkentDay(review.bookingStartsAt)}, {formatTashkentTime(review.bookingStartsAt)}
              </span>
            </div>
            <div className={styles.rating} role="img" aria-label={ratingLabel(review.rating)}>
              <span aria-hidden="true">{ratingStars(review.rating)}</span>
            </div>
            <p className={styles.comment}>{review.comment || <span className="muted">Без текста</span>}</p>
            <div className={styles.toggleCell}>
              <button
                type="button"
                role="switch"
                aria-checked={isPublic}
                aria-label={`Показ на сайте: ${publicToggleLabel(isPublic)}`}
                className={`${styles.switch} ${isPublic ? styles.switchOn : ''}`}
                disabled={busy}
                onClick={() => onToggle(review, !isPublic)}
              >
                <span className={styles.switchKnob} aria-hidden="true" />
                <span>{busy ? 'Сохраняем…' : publicToggleLabel(isPublic)}</span>
              </button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
