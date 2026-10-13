import { describe, expect, it } from 'vitest'

import { ADMIN_PAGE_SIZE_DEFAULT } from '@barber/shared'

import {
  EMPTY_REVIEW_FILTERS,
  buildReviewsQuery,
  hasActiveReviewFilters,
  publicToggleLabel,
  ratingLabel,
  ratingStars,
  validateRatingRange,
} from './reviews'

describe('buildReviewsQuery', () => {
  it('без фильтров передаёт только страницу и размер', () => {
    expect(buildReviewsQuery(EMPTY_REVIEW_FILTERS, 2)).toEqual({
      page: 2,
      pageSize: ADMIN_PAGE_SIZE_DEFAULT,
      barberId: undefined,
      isPublic: undefined,
      minRating: undefined,
      maxRating: undefined,
    })
  })

  it('превращает строки формы в число и булево значение', () => {
    expect(
      buildReviewsQuery({ barberId: 'b-1', visibility: 'hidden', minRating: '2', maxRating: '4' }, 1),
    ).toMatchObject({ barberId: 'b-1', isPublic: false, minRating: 2, maxRating: 4 })
    expect(buildReviewsQuery({ ...EMPTY_REVIEW_FILTERS, visibility: 'public' }, 1).isPublic).toBe(true)
  })
})

describe('validateRatingRange', () => {
  it('от больше до — ошибка', () => {
    expect(validateRatingRange('5', '3')).toBe('Рейтинг «от» не может быть больше рейтинга «до»')
  })

  it('равные границы и неполный диапазон допустимы', () => {
    expect(validateRatingRange('4', '4')).toBeNull()
    expect(validateRatingRange('4', '')).toBeNull()
    expect(validateRatingRange('', '')).toBeNull()
  })
})

describe('hasActiveReviewFilters', () => {
  it('определяет, заданы ли фильтры', () => {
    expect(hasActiveReviewFilters(EMPTY_REVIEW_FILTERS)).toBe(false)
    expect(hasActiveReviewFilters({ ...EMPTY_REVIEW_FILTERS, minRating: '3' })).toBe(true)
  })
})

describe('отображение рейтинга', () => {
  it('звёзды и подпись', () => {
    expect(ratingStars(4)).toBe('★★★★☆')
    expect(ratingStars(5)).toBe('★★★★★')
    expect(ratingLabel(3)).toBe('Оценка 3 из 5')
    expect(publicToggleLabel(true)).toBe('Показан на сайте')
    expect(publicToggleLabel(false)).toBe('Скрыт')
  })
})
