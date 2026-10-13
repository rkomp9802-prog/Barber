import { canChangeBooking } from '../domain/booking-rules'
import type { BookingRules } from '../domain/settings'
import { AppError, isUniqueViolation } from '../errors'
import type { BookingRecord } from '../repositories/types'
import { cancelBooking } from '../services/booking-service'
import { loadRules } from '../services/context'
import type { BotDeps } from './deps'

/** Действия клиента в боте. Правила (окно отмены, публичность отзыва) берутся из общих сервисов. */

const UPCOMING_LIMIT = 10
const HISTORY_LIMIT = 50
/** Как в POST /reviews (createReviewSchema). */
export const REVIEW_COMMENT_MAX = 1000

type Ownership =
  | { readonly kind: 'ok'; readonly booking: BookingRecord }
  | { readonly kind: 'not_found' }
  | { readonly kind: 'forbidden' }

/** Запись существует и принадлежит клиенту с этим telegram_id. */
export async function findOwnBooking(deps: BotDeps, bookingId: string, telegramId: bigint): Promise<Ownership> {
  const booking = await deps.repo.findBookingById(bookingId)
  if (!booking) return { kind: 'not_found' }
  const client = await deps.repo.findClientByTelegramId(telegramId)
  return client?.id === booking.clientId ? { kind: 'ok', booking } : { kind: 'forbidden' }
}

export type UpcomingBooking = { readonly booking: BookingRecord; readonly canCancel: boolean }
export type UpcomingList = { readonly items: readonly UpcomingBooking[]; readonly rules: BookingRules }

/** Предстоящие подтверждённые записи клиента, ближайшие первыми. */
export async function listUpcoming(deps: BotDeps, telegramId: bigint): Promise<UpcomingList> {
  const rules = await loadRules(deps.ctx)
  const client = await deps.repo.findClientByTelegramId(telegramId)
  if (!client) return { items: [], rules }
  const now = deps.ctx.now()
  const all = await deps.ctx.repos.bookings.listByClient(client.id, HISTORY_LIMIT)
  const items = all
    .filter(booking => booking.status === 'confirmed' && booking.startsAt.getTime() > now)
    .toSorted((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
    .slice(0, UPCOMING_LIMIT)
    .map(booking => ({ booking, canCancel: canChangeBooking(booking.status, booking.startsAt.getTime(), rules, now) }))
  return { items, rules }
}

export type CancelResult =
  | { readonly kind: 'cancelled'; readonly booking: BookingRecord }
  | { readonly kind: 'rejected'; readonly message: string }

/** Отмена через общий сервис: та же проверка cancel_cutoff_min и те же уведомления, что у сайта. */
export async function cancelOwnBooking(deps: BotDeps, bookingId: string, telegramId: bigint): Promise<CancelResult> {
  const own = await findOwnBooking(deps, bookingId, telegramId)
  if (own.kind === 'not_found') return { kind: 'rejected', message: 'Запись не найдена' }
  if (own.kind === 'forbidden') return { kind: 'rejected', message: 'Это не ваша запись' }
  try {
    await cancelBooking(deps.ctx, { log: deps.log }, own.booking.manageToken)
    return { kind: 'cancelled', booking: { ...own.booking, status: 'cancelled' } }
  } catch (error: unknown) {
    if (error instanceof AppError) return { kind: 'rejected', message: error.message }
    throw error
  }
}

export type RateResult = 'rated' | 'not_found' | 'forbidden' | 'not_completed' | 'already'

/** Callback rate:<bookingId>:<1-5> — только клиент записи, только завершённый визит, один отзыв. */
export async function rateBooking(
  deps: BotDeps,
  bookingId: string,
  telegramId: bigint,
  rating: number,
): Promise<RateResult> {
  const own = await findOwnBooking(deps, bookingId, telegramId)
  if (own.kind !== 'ok') return own.kind
  const { booking } = own
  if (booking.status !== 'completed') return 'not_completed'
  if (await deps.ctx.repos.reviews.existsForBooking(booking.id)) return 'already'
  const rules = await loadRules(deps.ctx)
  try {
    await deps.ctx.repos.reviews.create({
      bookingId: booking.id,
      barberId: booking.barberId,
      clientId: booking.clientId,
      rating,
      comment: null,
      isPublic: rating >= rules.reviewPublicMinRating,
    })
    return 'rated'
  } catch (error: unknown) {
    if (isUniqueViolation(error)) return 'already'
    throw error
  }
}

export type CommentResult = 'saved' | 'not_found' | 'forbidden' | 'already' | 'too_long' | 'empty'

/** Комментарий к уже поставленной оценке (ответ на сообщение бота). */
export async function saveComment(
  deps: BotDeps,
  bookingId: string,
  telegramId: bigint,
  text: string,
): Promise<CommentResult> {
  const comment = text.trim()
  if (!comment) return 'empty'
  if (comment.length > REVIEW_COMMENT_MAX) return 'too_long'
  const own = await findOwnBooking(deps, bookingId, telegramId)
  if (own.kind !== 'ok') return own.kind
  const saved = await deps.repo.setReviewComment(bookingId, comment)
  return saved ? 'saved' : 'already'
}
