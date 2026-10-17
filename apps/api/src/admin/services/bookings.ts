import type { AdminBookingDto, AdminBookingsQuery, Paginated } from '@barber/shared'
import type { z } from 'zod'
import { adminBookingCreateSchema, adminBookingUpdateSchema } from '@barber/shared'
import { loadCalendars, quoteBarbers, type QuotedBarber } from '../../services/calendars'
import { loadRules, type RequestScope } from '../../services/context'
import { safeNotify } from '../../notifications/notifier'
import { AppError } from '../../errors'
import { generateManageToken } from '../../lib/tokens'
import type { BarberCalendar } from '../../domain/slots'
import { MINUTE_MS, dateKeyInZone, dayBoundsUtc, type Interval } from '../../domain/time'
import type { Quote } from '../../domain/pricing'
import type { BookingRecord } from '../../repositories/types'
import { manualRejection, statusRejection, type AdminStatusTarget, type ManualRejection, type StatusRejection } from '../domain/booking-rules'
import { requireFound, type AdminContext, type AdminScope } from './context'
import { toBookingDto } from './mappers'
import type { BookingFilter } from '../repositories/types'

export type BookingCreate = z.infer<typeof adminBookingCreateSchema>
export type BookingUpdate = z.infer<typeof adminBookingUpdateSchema>

/** «Сегодня» отдаёт всё за день; для салона этого с запасом. */
const TODAY_LIMIT = 200

function spanFor(startMs: number, durationMin: number): Interval {
  return { start: startMs, end: startMs + durationMin * MINUTE_MS }
}

function toFilter(query: AdminBookingsQuery, timeZone: string): BookingFilter {
  return {
    from: query.from ? new Date(dayBoundsUtc(query.from, timeZone).start) : undefined,
    to: query.to ? new Date(dayBoundsUtc(query.to, timeZone).end) : undefined,
    barberId: query.barberId,
    statuses: query.status,
    source: query.source,
    search: query.search,
    order: query.order,
    offset: (query.page - 1) * query.pageSize,
    limit: query.pageSize,
  }
}

/** GET /bookings — список по startsAt с фильтрами и пагинацией. */
export async function listBookings(ctx: AdminContext, query: AdminBookingsQuery): Promise<Paginated<AdminBookingDto>> {
  const rules = await loadRules(ctx.core)
  const { items, total } = await ctx.admin.bookings.list(toFilter(query, rules.timezone))
  return { items: items.map(toBookingDto), total, page: query.page, pageSize: query.pageSize }
}

/** GET /bookings/today — все записи сегодняшнего дня по Ташкенту, все статусы. */
export async function listTodayBookings(ctx: AdminContext): Promise<AdminBookingDto[]> {
  const rules = await loadRules(ctx.core)
  const bounds = dayBoundsUtc(dateKeyInZone(ctx.core.now(), rules.timezone), rules.timezone)
  const { items } = await ctx.admin.bookings.list({
    from: new Date(bounds.start),
    to: new Date(bounds.end),
    order: 'asc',
    offset: 0,
    limit: TODAY_LIMIT,
  })
  return items.map(toBookingDto)
}

export async function getBooking(ctx: AdminContext, id: string): Promise<AdminBookingDto> {
  return toBookingDto(await getBookingRecord(ctx, id))
}

async function getBookingRecord(ctx: AdminContext, id: string): Promise<BookingRecord> {
  return requireFound(await ctx.admin.bookings.findById(id), 'Запись не найдена')
}

function rejectionError(rejection: ManualRejection): AppError {
  switch (rejection) {
    case 'PAST':
      return new AppError('VALIDATION_ERROR', 'Нельзя записать на время в прошлом')
    case 'TOO_FAR':
      return new AppError('VALIDATION_ERROR', 'Ручная запись возможна не дальше 365 дней от сегодня')
    case 'SLOT_TAKEN':
      return new AppError('SLOT_TAKEN')
    case 'OUTSIDE_WORKING_HOURS':
      return new AppError('OUTSIDE_WORKING_HOURS', 'Вне рабочего времени барбера. Подтвердите запись с force: true')
  }
}

async function calendarFor(
  ctx: AdminContext,
  quoted: readonly QuotedBarber[],
  span: Interval,
  excludeBookingId?: string,
): Promise<BarberCalendar> {
  const [calendar] = await loadCalendars(ctx.core.repos, quoted, span, ctx.core.now(), excludeBookingId)
  return requireFound(calendar, 'Барбер не найден')
}

/** Общая проверка для ручной записи и переноса (domain/booking-rules). */
async function assertManualAllowed(
  ctx: AdminContext,
  calendar: BarberCalendar,
  span: Interval,
  force: boolean,
): Promise<void> {
  const rules = await loadRules(ctx.core)
  const rejection = manualRejection(calendar, span, rules.timezone, ctx.core.now(), force)
  if (rejection) throw rejectionError(rejection)
}

/** POST /bookings — запись администратором: источник admin, без min_notice, с проверкой пересечений. */
export async function createManualBooking(ctx: AdminContext, input: BookingCreate): Promise<AdminBookingDto> {
  const quoted = await quoteBarbers(ctx.core.repos, input.serviceIds, input.barberId)
  const quote = quoted[0]
  if (!quote) throw new AppError('SERVICE_UNAVAILABLE')
  const span = spanFor(Date.parse(input.startsAt), quote.quote.totalDurationMin)
  const calendar = await calendarFor(ctx, quoted, span)
  await assertManualAllowed(ctx, calendar, span, input.force)
  const booking = await ctx.core.repos.bookings.create({
    barberId: input.barberId,
    startsAt: new Date(span.start),
    endsAt: new Date(span.end),
    totalPrice: quote.quote.totalPrice,
    totalDurationMin: quote.quote.totalDurationMin,
    source: 'admin',
    manageToken: generateManageToken(),
    client: { kind: 'guest', name: input.client.name, phone: input.client.phone },
    services: quote.quote.items,
    // Ручная запись администратора подтверждается сразу: клиент позвонил, номер подтверждать не нужно.
    hold: null,
  }, new Date(ctx.core.now()))
  return toBookingDto(booking)
}

function statusError(rejection: StatusRejection): AppError {
  if (rejection === 'BOOKING_NOT_ACTIVE') return new AppError('BOOKING_NOT_ACTIVE')
  return new AppError('VALIDATION_ERROR', 'Отметить завершение или неявку можно только после начала записи')
}

/** Переход статуса из confirmed; письмо клиенту и барберу — только при отмене. */
async function changeStatus(
  ctx: AdminContext,
  scope: AdminScope,
  booking: BookingRecord,
  target: AdminStatusTarget,
): Promise<AdminBookingDto> {
  const rejection = statusRejection(booking.status, target, booking.startsAt.getTime(), ctx.core.now())
  if (rejection) throw statusError(rejection)
  const updated = await ctx.admin.bookings.setStatus(booking.id, ['confirmed'], target)
  const saved = requireFound(updated, 'Запись уже не подтверждена')
  if (target === 'cancelled') {
    await safeNotify(scope.log, 'bookingCancelled', saved.id, () => ctx.core.notifier.bookingCancelled(saved))
  }
  return toBookingDto(saved)
}

/** Перенос: тот же барбер и услуги, новое время; напоминания сбрасываются в репозитории. */
async function reschedule(
  ctx: AdminContext,
  scope: AdminScope,
  booking: BookingRecord,
  startsAt: string,
  force: boolean,
): Promise<AdminBookingDto> {
  if (booking.status !== 'confirmed') throw new AppError('BOOKING_NOT_ACTIVE')
  const quote: Quote = {
    barberId: booking.barberId,
    totalDurationMin: booking.totalDurationMin,
    totalPrice: booking.totalPrice,
    items: booking.services,
  }
  const quoted: QuotedBarber[] = [{ barberId: booking.barberId, sortOrder: 0, quote }]
  const span = spanFor(Date.parse(startsAt), booking.totalDurationMin)
  const calendar = await calendarFor(ctx, quoted, span, booking.id)
  await assertManualAllowed(ctx, calendar, span, force)
  const moved = await ctx.core.repos.bookings.reschedule(booking.id, new Date(span.start), new Date(span.end))
  const saved = requireFound(moved, 'Запись уже не подтверждена')
  await safeNotify(scope.log, 'bookingRescheduled', saved.id, () =>
    ctx.core.notifier.bookingRescheduled(saved, booking.startsAt),
  )
  return toBookingDto(saved)
}

/** PATCH /bookings/:id — либо { status }, либо { startsAt, force } (перенос). */
export async function updateBooking(
  ctx: AdminContext,
  scope: AdminScope,
  id: string,
  input: BookingUpdate,
): Promise<AdminBookingDto> {
  const booking = await getBookingRecord(ctx, id)
  if ('status' in input) return changeStatus(ctx, scope, booking, input.status)
  return reschedule(ctx, scope, booking, input.startsAt, input.force)
}
