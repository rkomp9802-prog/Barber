import { ADMIN_PAGE_SIZE_DEFAULT, type AdminReviewsQuery } from '@barber/shared'

/** Фильтр публичности: '' — все, 'public' — показываются на сайте, 'hidden' — скрытые. */
export type ReviewVisibility = '' | 'public' | 'hidden'

/** Рейтинги храним строками, потому что select отдаёт строку; '' — без ограничения. */
export type ReviewFilters = {
  barberId: string
  visibility: ReviewVisibility
  minRating: string
  maxRating: string
}

export const EMPTY_REVIEW_FILTERS: ReviewFilters = {
  barberId: '',
  visibility: '',
  minRating: '',
  maxRating: '',
}

export const RATING_VALUES = [1, 2, 3, 4, 5] as const

export const VISIBILITY_LABELS: Readonly<Record<ReviewVisibility, string>> = {
  '': 'Все отзывы',
  public: 'Показаны на сайте',
  hidden: 'Скрытые',
}

export function hasActiveReviewFilters(filters: ReviewFilters): boolean {
  return Object.values(filters).some(value => value !== '')
}

/** Ошибка диапазона рейтинга или null. */
export function validateRatingRange(minRating: string, maxRating: string): string | null {
  if (minRating && maxRating && Number(minRating) > Number(maxRating)) {
    return 'Рейтинг «от» не может быть больше рейтинга «до»'
  }
  return null
}

/** Параметры GET /admin/reviews; пустые фильтры не передаются. */
export function buildReviewsQuery(filters: ReviewFilters, page: number): AdminReviewsQuery {
  return {
    page,
    pageSize: ADMIN_PAGE_SIZE_DEFAULT,
    barberId: filters.barberId || undefined,
    isPublic: filters.visibility === '' ? undefined : filters.visibility === 'public',
    minRating: filters.minRating ? Number(filters.minRating) : undefined,
    maxRating: filters.maxRating ? Number(filters.maxRating) : undefined,
  }
}

/** Оценка словами для подписи и aria-label: «Оценка 4 из 5». */
export function ratingLabel(rating: number): string {
  return `Оценка ${rating} из 5`
}

/** Звёзды для визуального вывода: 4 → '★★★★☆'. */
export function ratingStars(rating: number): string {
  const filled = Math.min(5, Math.max(0, Math.round(rating)))
  return '★'.repeat(filled) + '☆'.repeat(5 - filled)
}

export function publicToggleLabel(isPublic: boolean): string {
  return isPublic ? 'Показан на сайте' : 'Скрыт'
}
