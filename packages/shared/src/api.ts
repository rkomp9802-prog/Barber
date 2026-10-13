import { z } from 'zod'

/**
 * Контракт REST API /api/v1 (spec-final.md §8–9).
 * Его используют apps/api (валидация входа), apps/web, apps/miniapp и админка.
 * Все абсолютные даты — ISO 8601 в UTC; даты дня — 'YYYY-MM-DD' по Asia/Tashkent.
 */

export const API_PREFIX = '/api/v1'

const uuid = z.string().uuid()
const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Дата должна быть в формате YYYY-MM-DD')
const isoDateTime = z.string().datetime({ offset: true })
const uzPhone = z.string().regex(/^\+998\d{9}$/, 'Телефон в формате +998XXXXXXXXX')

export const BOOKING_STATUSES = ['confirmed', 'completed', 'cancelled', 'no_show'] as const
export const BOOKING_SOURCES = ['web', 'telegram', 'admin'] as const
export type BookingStatus = (typeof BOOKING_STATUSES)[number]
export type BookingSource = (typeof BOOKING_SOURCES)[number]

/* ---------- Ошибки ---------- */

export const API_ERROR_CODES = [
  'VALIDATION_ERROR', // 400/422
  'NOT_FOUND', // 404
  'SLOT_TAKEN', // 409 — PostgreSQL 23P01 или слот уже занят
  'OUTSIDE_WORKING_HOURS', // 422
  'TOO_SOON', // 422 — меньше min_notice_min до начала
  'TOO_FAR', // 422 — дальше booking_horizon_days
  'SERVICE_UNAVAILABLE', // 422 — барбер не оказывает услугу
  'CUTOFF_PASSED', // 422 — отмена/перенос позже cancel_cutoff_min
  'BOOKING_NOT_ACTIVE', // 409 — запись уже отменена/завершена
  'UNAUTHORIZED', // 401
  'RATE_LIMITED', // 429
  'FORBIDDEN', // 403 — админка: нет CSRF-заголовка или чужой Origin
  'NOT_CONFIGURED', // 503 — интеграция (Storage, Telegram) не настроена
  'INTERNAL', // 500
] as const
export type ApiErrorCode = (typeof API_ERROR_CODES)[number]

/** Тело любого ответа с ошибкой. */
export type ApiError = {
  code: ApiErrorCode
  message: string
  details?: unknown
}

/* ---------- Публичные сущности ---------- */

export type ServiceDto = {
  id: string
  name: string
  description: string
  durationMin: number
  price: number
}

export type BarberDto = {
  id: string
  name: string
  role: string
  bio: string
  photoUrl: string | null
  experienceYears: number
  rating: number
  reviewsCount: number
  serviceIds: string[]
  portfolio: string[]
}

export type PublicReviewDto = {
  id: string
  clientName: string
  barberId: string
  barberName: string
  rating: number
  comment: string
  createdAt: string
}

/* ---------- Доступность ---------- */

/** GET /availability?serviceIds=a,b&barberId=<uuid|any>&date=YYYY-MM-DD */
export const availabilityQuerySchema = z.object({
  serviceIds: z
    .string()
    .transform(value => value.split(',').filter(Boolean))
    .pipe(z.array(uuid).min(1).max(5)),
  barberId: z.union([uuid, z.literal('any')]),
  date: dateKey,
})
export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>

export type SlotDto = {
  /** Начало в UTC. */
  startsAt: string
  /** 'HH:MM' по Ташкенту — для показа. */
  time: string
  /** Барберы, свободные в этот слот (для barberId=any их может быть несколько). */
  barberIds: string[]
}

export type AvailabilityResponse = {
  date: string
  durationMin: number
  slots: SlotDto[]
}

/** GET /availability/days?serviceIds=..&barberId=..&from=YYYY-MM-DD&days=14 */
export const availabilityDaysQuerySchema = z.object({
  serviceIds: availabilityQuerySchema.shape.serviceIds,
  barberId: availabilityQuerySchema.shape.barberId,
  from: dateKey,
  days: z.coerce.number().int().min(1).max(31).default(14),
})
export type AvailabilityDaysQuery = z.infer<typeof availabilityDaysQuerySchema>

export type AvailabilityDaysResponse = {
  days: { date: string; hasSlots: boolean }[]
}

/* ---------- Записи ---------- */

export const clientInputSchema = z.object({
  name: z.string().trim().min(2).max(60),
  phone: uzPhone,
})

/** POST /bookings */
export const createBookingSchema = z.object({
  serviceIds: z.array(uuid).min(1).max(5),
  barberId: z.union([uuid, z.literal('any')]),
  startsAt: isoDateTime,
  client: clientInputSchema,
})
export type CreateBookingInput = z.infer<typeof createBookingSchema>

export type BookingServiceDto = {
  serviceId: string
  name: string
  durationMin: number
  price: number
}

export type BookingDto = {
  id: string
  status: BookingStatus
  source: BookingSource
  startsAt: string
  endsAt: string
  totalPrice: number
  totalDurationMin: number
  barber: { id: string; name: string }
  client: { name: string; phone: string }
  services: BookingServiceDto[]
  /** Длинный случайный токен для /booking/[token]. Отдаётся только владельцу записи. */
  manageToken: string
  /** Можно ли ещё отменить/перенести (учитывает cancel_cutoff_min). */
  canChange: boolean
  /** Ссылка t.me/<bot>?start=b_<token> для привязки Telegram, если бот настроен. */
  telegramLink: string | null
}

/** POST /bookings/:token/reschedule */
export const rescheduleBookingSchema = z.object({
  startsAt: isoDateTime,
})
export type RescheduleBookingInput = z.infer<typeof rescheduleBookingSchema>

/* ---------- Отзывы ---------- */

/** POST /reviews */
export const createReviewSchema = z.object({
  manageToken: z.string().min(32),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
})
export type CreateReviewInput = z.infer<typeof createReviewSchema>

/* ---------- Telegram Mini App ---------- */

/** Заголовок, в котором Mini App передаёт Telegram initData (spec §10). */
export const TELEGRAM_INIT_DATA_HEADER = 'x-telegram-init-data'

/* ---------- Админка ---------- */

export const adminLoginSchema = z.object({
  login: z.string().trim().min(3).max(50),
  password: z.string().min(8).max(200),
})
export type AdminLoginInput = z.infer<typeof adminLoginSchema>

export const ADMIN_SESSION_COOKIE = 'barber_admin_session'

/** Ключи таблицы settings и значения по умолчанию (spec §5). */
export const DEFAULT_SETTINGS = {
  cancel_cutoff_min: 30,
  slot_step_min: 15,
  booking_horizon_days: 30,
  min_notice_min: 30,
  reminder_day_minutes: 1440,
  reminder_short_minutes: 30,
  review_delay_min: 60,
  timezone: 'Asia/Tashkent',
  review_public_min_rating: 4,
} as const
export type SettingKey = keyof typeof DEFAULT_SETTINGS
