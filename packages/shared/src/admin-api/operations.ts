import { z } from 'zod'
import {
  BOOKING_SOURCES,
  BOOKING_STATUSES,
  type BookingServiceDto,
  type BookingSource,
  type BookingStatus,
} from '../api'
import { paginationQuerySchema } from './common'
import { dateKey, isoDateTime, uuid, uzPhone } from './primitives'

/* ---------- Исключения (time_off) ---------- */
// GET    /admin/time-off?from&to&barberId  → AdminTimeOffDto[]
// POST   /admin/time-off   body: AdminTimeOffCreateInput → 201 AdminTimeOffResultDto
// PATCH  /admin/time-off/:id body: AdminTimeOffUpdateInput → AdminTimeOffResultDto
// DELETE /admin/time-off/:id → 204
// Записи, попавшие в исключение, НЕ отменяются автоматически — они возвращаются в conflicts.

export const TIME_OFF_TYPES = ['day_off', 'vacation', 'sick', 'other', 'shop_closed'] as const
export type TimeOffType = (typeof TIME_OFF_TYPES)[number]

const timeOffFields = {
  /** null — исключение для всего барбершопа. Тип shop_closed — только с null. */
  barberId: uuid.nullable(),
  startsAt: isoDateTime,
  endsAt: isoDateTime,
  type: z.enum(TIME_OFF_TYPES),
  note: z.string().trim().max(500).nullable(),
}

export const adminTimeOffCreateSchema = z.strictObject({
  ...timeOffFields,
  type: timeOffFields.type.default('other'),
  note: timeOffFields.note.default(null),
})
export type AdminTimeOffCreateInput = z.input<typeof adminTimeOffCreateSchema>

export const adminTimeOffUpdateSchema = z.strictObject(timeOffFields).partial()
export type AdminTimeOffUpdateInput = z.infer<typeof adminTimeOffUpdateSchema>

export const adminTimeOffQuerySchema = z.object({
  from: dateKey.optional(),
  to: dateKey.optional(),
  /** uuid барбера или 'shop' — только исключения всего салона. */
  barberId: z.union([uuid, z.literal('shop')]).optional(),
})
export type AdminTimeOffQuery = z.infer<typeof adminTimeOffQuerySchema>

export type AdminTimeOffDto = {
  id: string
  barberId: string | null
  barberName: string | null
  startsAt: string
  endsAt: string
  type: TimeOffType
  note: string | null
}

export type AdminTimeOffResultDto = {
  timeOff: AdminTimeOffDto
  /** Подтверждённые записи, пересекающиеся с исключением (их нужно перенести/отменить вручную). */
  conflicts: AdminBookingDto[]
}

/* ---------- Записи ---------- */
// GET   /admin/bookings?…            → Paginated<AdminBookingDto> (по startsAt)
// GET   /admin/bookings/today        → AdminBookingDto[] (сегодня по Ташкенту, все статусы)
// GET   /admin/bookings/:id          → AdminBookingDto
// POST  /admin/bookings              body: AdminBookingCreateInput → 201 AdminBookingDto (source='admin')
// PATCH /admin/bookings/:id          body: AdminBookingUpdateInput → AdminBookingDto
//
// Ручная запись: min_notice_min и booking_horizon_days не применяются (можно записать
// «прямо сейчас», но не раньше начала сегодняшнего дня и не дальше 365 дней).
// Пересечение с другой записью — всегда 409 SLOT_TAKEN. Нерабочее время / обед / исключение —
// 422 OUTSIDE_WORKING_HOURS, если не передан force: true (тогда разрешено).
//
// Статусы: только из confirmed → completed | cancelled | no_show. Из других статусов — 409 BOOKING_NOT_ACTIVE.
// completed/no_show — только после начала записи, иначе 422 VALIDATION_ERROR.
// Перенос — только confirmed, cancel_cutoff_min не действует, проверки как у ручной записи;
// напоминания сбрасываются. Отмена и перенос уведомляют клиента и барбера.

export const adminBookingsQuerySchema = paginationQuerySchema.extend({
  from: dateKey.optional(),
  to: dateKey.optional(),
  barberId: uuid.optional(),
  /** Один статус или несколько через запятую: 'confirmed,completed'. */
  status: z
    .string()
    .transform(value => value.split(',').filter(Boolean))
    .pipe(z.array(z.enum(BOOKING_STATUSES)).min(1))
    .optional(),
  source: z.enum(BOOKING_SOURCES).optional(),
  /** Поиск по имени клиента или цифрам телефона. */
  search: z.string().trim().min(1).max(60).optional(),
  order: z.enum(['asc', 'desc']).default('asc'),
})
export type AdminBookingsQuery = z.infer<typeof adminBookingsQuerySchema>

export const adminBookingCreateSchema = z.strictObject({
  serviceIds: z.array(uuid).min(1).max(5),
  barberId: uuid,
  startsAt: isoDateTime,
  client: z.strictObject({
    name: z.string().trim().min(2).max(60),
    phone: uzPhone,
  }),
  /** Разрешить вне рабочего времени/обеда/исключения. Пересечение с записями не разрешается никогда. */
  force: z.boolean().default(false),
})
export type AdminBookingCreateInput = z.input<typeof adminBookingCreateSchema>

export const ADMIN_STATUS_TARGETS = ['completed', 'cancelled', 'no_show'] as const

export const adminBookingUpdateSchema = z.union([
  z.strictObject({ status: z.enum(ADMIN_STATUS_TARGETS) }),
  z.strictObject({ startsAt: isoDateTime, force: z.boolean().default(false) }),
])
export type AdminBookingUpdateInput = z.input<typeof adminBookingUpdateSchema>

export type AdminBookingDto = {
  id: string
  status: BookingStatus
  source: BookingSource
  startsAt: string
  endsAt: string
  totalPrice: number
  totalDurationMin: number
  barber: { id: string; name: string }
  client: { id: string; name: string; phone: string }
  services: BookingServiceDto[]
  createdAt: string
}

/* ---------- Отзывы ---------- */
// GET   /admin/reviews?…     → Paginated<AdminReviewDto> (новые сверху)
// PATCH /admin/reviews/:id   body: AdminReviewUpdateInput → AdminReviewDto

const booleanQuery = z.enum(['true', 'false']).transform(value => value === 'true')

export const adminReviewsQuerySchema = paginationQuerySchema.extend({
  barberId: uuid.optional(),
  isPublic: booleanQuery.optional(),
  minRating: z.coerce.number().int().min(1).max(5).optional(),
  maxRating: z.coerce.number().int().min(1).max(5).optional(),
})
export type AdminReviewsQuery = z.infer<typeof adminReviewsQuerySchema>

export const adminReviewUpdateSchema = z.strictObject({ isPublic: z.boolean() })
export type AdminReviewUpdateInput = z.infer<typeof adminReviewUpdateSchema>

export type AdminReviewDto = {
  id: string
  bookingId: string
  bookingStartsAt: string
  barber: { id: string; name: string }
  client: { name: string; phone: string }
  rating: number
  comment: string
  isPublic: boolean
  createdAt: string
}

/* ---------- Настройки ---------- */
// GET /admin/settings → AdminSettingsDto (значения по умолчанию подставлены)
// PUT /admin/settings body: AdminSettingsInput (любое подмножество ключей) → AdminSettingsDto
// Неизвестные ключи и значения вне диапазона → 422.

function isKnownTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value })
    return true
  } catch {
    return false
  }
}

const WEEK_MIN = 7 * 24 * 60

export const settingValueSchemas = {
  cancel_cutoff_min: z.number().int().min(0).max(WEEK_MIN),
  slot_step_min: z.number().int().min(5).max(240).multipleOf(5),
  booking_horizon_days: z.number().int().min(1).max(365),
  min_notice_min: z.number().int().min(0).max(WEEK_MIN),
  reminder_day_minutes: z.number().int().min(60).max(WEEK_MIN),
  reminder_short_minutes: z.number().int().min(5).max(24 * 60),
  review_delay_min: z.number().int().min(0).max(WEEK_MIN),
  timezone: z.string().refine(isKnownTimeZone, 'Неизвестный часовой пояс'),
  review_public_min_rating: z.number().int().min(1).max(5),
} as const

export const adminSettingsSchema = z
  .strictObject(settingValueSchemas)
  .partial()
  .refine(value => Object.keys(value).length > 0, 'Передайте хотя бы одну настройку')
export type AdminSettingsInput = z.infer<typeof adminSettingsSchema>

export type AdminSettingsDto = {
  cancel_cutoff_min: number
  slot_step_min: number
  booking_horizon_days: number
  min_notice_min: number
  reminder_day_minutes: number
  reminder_short_minutes: number
  review_delay_min: number
  timezone: string
  review_public_min_rating: number
}

