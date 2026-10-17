import { MAX_ACTIVE_BOOKINGS_PER_PHONE, type BookingDto, type CreateBookingInput } from '@barber/shared'
import { changeRejection, rankFreeBarbers } from '../domain/booking-rules'
import type { BookingRules } from '../domain/settings'
import { checkStart, type BarberCalendar } from '../domain/slots'
import { MINUTE_MS, dateKeyInZone, dayBoundsUtc } from '../domain/time'
import { AppError, isExclusionViolation } from '../errors'
import { generateManageToken, isWellFormedManageToken } from '../lib/tokens'
import { safeNotify } from '../notifications/notifier'
import type { BookingClientRef, BookingRecord, ClientRecord } from '../repositories/types'
import { loadCalendars, quoteBarbers } from './calendars'
import { loadRules, type RequestScope, type ServiceContext } from './context'
import { toBookingDto } from './mappers'

const MY_BOOKINGS_LIMIT = 50

function parseStart(iso: string): number {
  const start = Date.parse(iso)
  if (Number.isNaN(start)) throw new AppError('VALIDATION_ERROR', 'Неверное время начала')
  return start
}

function dto(ctx: ServiceContext, rules: BookingRules, booking: BookingRecord): BookingDto {
  return toBookingDto(booking, { rules, now: ctx.now(), botUsername: ctx.telegramBotUsername })
}

/** Создаёт запись у первого свободного кандидата; при гонке (23P01) пробует следующего. */
async function insertWithFallback(
  ctx: ServiceContext,
  candidates: readonly BarberCalendar[],
  start: number,
  client: BookingClientRef,
): Promise<BookingRecord> {
  for (const candidate of candidates) {
    try {
      return await ctx.repos.bookings.create({
        barberId: candidate.barberId,
        startsAt: new Date(start),
        endsAt: new Date(start + candidate.quote.totalDurationMin * MINUTE_MS),
        totalPrice: candidate.quote.totalPrice,
        totalDurationMin: candidate.quote.totalDurationMin,
        source: client.kind === 'existing' ? 'telegram' : 'web',
        manageToken: generateManageToken(),
        client,
        services: candidate.quote.items,
      })
    } catch (error: unknown) {
      if (!isExclusionViolation(error)) throw error
    }
  }
  throw new AppError('SLOT_TAKEN')
}

/** POST /bookings. telegramClient — клиент Mini App (если initData проверен), иначе гость сайта. */
export async function createBooking(
  ctx: ServiceContext,
  scope: RequestScope,
  input: CreateBookingInput,
  telegramClient: ClientRecord | null,
): Promise<BookingDto> {
  const start = parseStart(input.startsAt)
  const now = ctx.now()
  const rules = await loadRules(ctx)
  const quoted = await quoteBarbers(ctx.repos, input.serviceIds, input.barberId)
  if (quoted.length === 0) throw new AppError('SERVICE_UNAVAILABLE', 'Нет барберов, которые делают эти услуги')
  const day = dayBoundsUtc(dateKeyInZone(start, rules.timezone), rules.timezone)
  const calendars = await loadCalendars(ctx.repos, quoted, day)
  const choice = rankFreeBarbers(calendars, start, rules, now)
  if (!choice.ok) throw new AppError(choice.reason)
  // Лимит предстоящих записей на номер — в базе, общий для всех инстансов API.
  const upcoming = await ctx.repos.bookings.countUpcomingByPhone(input.client.phone, new Date(now))
  if (upcoming >= MAX_ACTIVE_BOOKINGS_PER_PHONE) throw new AppError('TOO_MANY_BOOKINGS')
  const client: BookingClientRef = telegramClient
    ? { kind: 'existing', clientId: telegramClient.id, name: input.client.name, phone: input.client.phone }
    : { kind: 'guest', name: input.client.name, phone: input.client.phone }
  const booking = await insertWithFallback(ctx, choice.candidates, start, client)
  await safeNotify(scope.log, 'bookingCreated', booking.id, () => ctx.notifier.bookingCreated(booking))
  return dto(ctx, rules, booking)
}

async function findBookingOrThrow(ctx: ServiceContext, token: string): Promise<BookingRecord> {
  const booking = isWellFormedManageToken(token) ? await ctx.repos.bookings.findByToken(token) : null
  if (!booking) throw new AppError('NOT_FOUND', 'Запись не найдена')
  return booking
}

/** GET /bookings/:token */
export async function getBookingByToken(ctx: ServiceContext, token: string): Promise<BookingDto> {
  const [booking, rules] = await Promise.all([findBookingOrThrow(ctx, token), loadRules(ctx)])
  return dto(ctx, rules, booking)
}

function assertChangeable(booking: BookingRecord, rules: BookingRules, now: number): void {
  const rejection = changeRejection(booking.status, booking.startsAt.getTime(), rules, now)
  if (rejection) throw new AppError(rejection)
}

/** POST /bookings/:token/cancel */
export async function cancelBooking(ctx: ServiceContext, scope: RequestScope, token: string): Promise<BookingDto> {
  const [booking, rules] = await Promise.all([findBookingOrThrow(ctx, token), loadRules(ctx)])
  assertChangeable(booking, rules, ctx.now())
  const cancelled = await ctx.repos.bookings.cancel(booking.id)
  if (!cancelled) throw new AppError('BOOKING_NOT_ACTIVE')
  await safeNotify(scope.log, 'bookingCancelled', cancelled.id, () => ctx.notifier.bookingCancelled(cancelled))
  return dto(ctx, rules, cancelled)
}

/** POST /bookings/:token/reschedule — тот же барбер и услуги, новое время. */
export async function rescheduleBooking(
  ctx: ServiceContext,
  scope: RequestScope,
  token: string,
  startsAtIso: string,
): Promise<BookingDto> {
  const start = parseStart(startsAtIso)
  const now = ctx.now()
  const [booking, rules] = await Promise.all([findBookingOrThrow(ctx, token), loadRules(ctx)])
  assertChangeable(booking, rules, now)
  const quote = {
    barberId: booking.barberId,
    totalDurationMin: booking.totalDurationMin,
    totalPrice: booking.totalPrice,
    items: booking.services,
  }
  const day = dayBoundsUtc(dateKeyInZone(start, rules.timezone), rules.timezone)
  const [calendar] = await loadCalendars(ctx.repos, [{ barberId: booking.barberId, sortOrder: 0, quote }], day, booking.id)
  const rejection = calendar ? checkStart(calendar, start, rules, now) : 'OUTSIDE_WORKING_HOURS'
  if (rejection) throw new AppError(rejection)
  const endsAt = new Date(start + booking.totalDurationMin * MINUTE_MS)
  const moved = await ctx.repos.bookings.reschedule(booking.id, new Date(start), endsAt)
  if (!moved) throw new AppError('BOOKING_NOT_ACTIVE')
  await safeNotify(scope.log, 'bookingRescheduled', moved.id, () =>
    ctx.notifier.bookingRescheduled(moved, booking.startsAt),
  )
  return dto(ctx, rules, moved)
}

/** GET /me/bookings — записи клиента Mini App. */
export async function listClientBookings(ctx: ServiceContext, client: ClientRecord): Promise<BookingDto[]> {
  const [bookings, rules] = await Promise.all([
    ctx.repos.bookings.listByClient(client.id, MY_BOOKINGS_LIMIT),
    loadRules(ctx),
  ])
  return bookings.map(booking => dto(ctx, rules, booking))
}
