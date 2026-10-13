'use client'

import { useState } from 'react'

import { ADMIN_PAGE_SIZE_DEFAULT, type AdminReviewDto, type Paginated } from '@barber/shared'

import { listBarbers, listReviews, updateReview } from '@/lib/adminApi'
import {
  EMPTY_REVIEW_FILTERS,
  buildReviewsQuery,
  validateRatingRange,
  type ReviewFilters,
} from '@/lib/admin/reviews'
import { useAsyncData } from '@/lib/admin/useAsyncData'
import { errorMessage } from '@/lib/apiErrors'

import { AsyncContent, EmptyBlock } from '../StateBlocks'
import { ReviewFilterForm } from './ReviewFilterForm'
import { ReviewsList } from './ReviewsList'
import { ReviewsPagination } from './ReviewsPagination'
import styles from './reviews.module.css'

const EMPTY_PAGE: Paginated<AdminReviewDto> = {
  items: [],
  total: 0,
  page: 1,
  pageSize: ADMIN_PAGE_SIZE_DEFAULT,
}

export function ReviewsPage() {
  const [filters, setFilters] = useState<ReviewFilters>(EMPTY_REVIEW_FILTERS)
  const [page, setPage] = useState(1)
  // Переключения видимости, которые уже сохранены, но ещё не пришли в перезагруженном списке.
  const [overrides, setOverrides] = useState<Record<string, boolean>>({})
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [toggleError, setToggleError] = useState<string | null>(null)

  const rangeError = validateRatingRange(filters.minRating, filters.maxRating)
  const barbers = useAsyncData(listBarbers, [])
  // При неверном диапазоне рейтинга запрос не отправляем.
  const list = useAsyncData(
    () => (rangeError ? Promise.resolve(EMPTY_PAGE) : listReviews(buildReviewsQuery(filters, page))),
    [filters, page, rangeError],
  )

  function changeFilters(next: ReviewFilters) {
    setFilters(next)
    setPage(1)
    setOverrides({})
  }

  function changePage(next: number) {
    setPage(next)
    setOverrides({})
  }

  async function handleToggle(review: AdminReviewDto, isPublic: boolean) {
    setToggleError(null)
    setMessage(null)
    setTogglingId(review.id)
    try {
      const saved = await updateReview(review.id, { isPublic })
      setOverrides(current => ({ ...current, [saved.id]: saved.isPublic }))
      setMessage(saved.isPublic ? 'Отзыв показан на сайте' : 'Отзыв скрыт с сайта')
    } catch (error: unknown) {
      setToggleError(errorMessage(error))
    } finally {
      setTogglingId(null)
    }
  }

  return (
    <section className={styles.page} aria-labelledby="reviews-title">
      <h1 id="reviews-title" className={styles.title}>
        Отзывы
      </h1>

      <ReviewFilterForm filters={filters} onChange={changeFilters} barbers={barbers.state} />

      {message ? (
        <p role="status" className={styles.success}>
          {message}
        </p>
      ) : null}
      {toggleError ? (
        <p role="alert" className={styles.error}>
          {toggleError}
        </p>
      ) : null}

      {rangeError ? (
        <p role="alert" className={styles.error}>
          {rangeError}
        </p>
      ) : (
        <AsyncContent state={list.state} onRetry={list.reload}>
          {result => (
            <>
              {result.items.length === 0 ? (
                <EmptyBlock text="Отзывов по этим фильтрам нет." />
              ) : (
                <ReviewsList
                  reviews={result.items}
                  overrides={overrides}
                  togglingId={togglingId}
                  onToggle={handleToggle}
                />
              )}
              {result.total > 0 ? (
                <ReviewsPagination page={result.page} pageSize={result.pageSize} total={result.total} onPageChange={changePage} />
              ) : null}
            </>
          )}
        </AsyncContent>
      )}
    </section>
  )
}
