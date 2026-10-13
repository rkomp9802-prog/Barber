import type { CreateReviewInput, PublicReviewDto } from '@barber/shared'
import { AppError, isUniqueViolation } from '../errors'
import { isWellFormedManageToken } from '../lib/tokens'
import { loadRules, type ServiceContext } from './context'

const PUBLIC_REVIEWS_LIMIT = 20
const ALREADY_REVIEWED = 'Отзыв на эту запись уже оставлен'

/** GET /reviews/public — опубликованные отзывы с оценкой не ниже review_public_min_rating. */
export async function listPublicReviews(ctx: ServiceContext): Promise<PublicReviewDto[]> {
  const rules = await loadRules(ctx)
  return ctx.repos.reviews.listPublic(rules.reviewPublicMinRating, PUBLIC_REVIEWS_LIMIT)
}

/** POST /reviews — один отзыв на завершённую запись, доступ по manageToken. */
export async function createReview(ctx: ServiceContext, input: CreateReviewInput): Promise<{ id: string }> {
  const booking = isWellFormedManageToken(input.manageToken)
    ? await ctx.repos.bookings.findByToken(input.manageToken)
    : null
  if (!booking) throw new AppError('NOT_FOUND', 'Запись не найдена')
  if (booking.status !== 'completed') {
    throw new AppError('BOOKING_NOT_ACTIVE', 'Отзыв можно оставить только после визита')
  }
  if (await ctx.repos.reviews.existsForBooking(booking.id)) {
    throw new AppError('VALIDATION_ERROR', ALREADY_REVIEWED)
  }
  try {
    return await ctx.repos.reviews.create({
      bookingId: booking.id,
      barberId: booking.barberId,
      clientId: booking.clientId,
      rating: input.rating,
      comment: input.comment ? input.comment : null,
      isPublic: true,
    })
  } catch (error: unknown) {
    if (isUniqueViolation(error)) throw new AppError('VALIDATION_ERROR', ALREADY_REVIEWED)
    throw error
  }
}
