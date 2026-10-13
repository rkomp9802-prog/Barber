import type { BookingServiceDto, BookingSource, BookingStatus, PublicReviewDto } from '@barber/shared'
import type { BarberServiceLink, CatalogService } from '../domain/pricing'
import type { WeeklyRange } from '../domain/slots'

/**
 * Интерфейсы доступа к данным. Бизнес-логика и маршруты зависят только от них:
 * в продакшене — реализация на Prisma, в тестах — in-memory подделки.
 */

export type ServiceRecord = CatalogService & {
  readonly description: string
  readonly sortOrder: number
}

export type BarberRecord = {
  readonly id: string
  readonly name: string
  readonly role: string
  readonly bio: string
  readonly photoUrl: string | null
  readonly experienceYears: number
  readonly isActive: boolean
  readonly sortOrder: number
}

/** Барбер для публичной витрины: услуги, портфолио, рейтинг по отзывам. */
export type BarberProfile = BarberRecord & {
  readonly serviceIds: readonly string[]
  readonly portfolio: readonly string[]
  readonly rating: number
  readonly reviewsCount: number
}

export type BarberWeeklyRange = WeeklyRange & { readonly barberId: string }

export type TimeOffRecord = { readonly barberId: string | null; readonly startsAt: Date; readonly endsAt: Date }

export type BusyRecord = { readonly barberId: string; readonly startsAt: Date; readonly endsAt: Date }

export type ClientRecord = {
  readonly id: string
  readonly name: string
  readonly phone: string | null
  readonly telegramId: bigint | null
}

/** Запись со всем, что нужно для ответа и уведомлений. */
export type BookingRecord = {
  readonly id: string
  readonly clientId: string
  readonly barberId: string
  readonly barberName: string
  readonly client: { readonly name: string; readonly phone: string | null }
  readonly status: BookingStatus
  readonly source: BookingSource
  readonly startsAt: Date
  readonly endsAt: Date
  readonly totalPrice: number
  readonly totalDurationMin: number
  readonly manageToken: string
  readonly services: readonly BookingServiceDto[]
  readonly createdAt: Date
}

/** Кто записывается: гость с сайта или уже известный клиент (Telegram). */
export type BookingClientRef =
  | { readonly kind: 'guest'; readonly name: string; readonly phone: string }
  | { readonly kind: 'existing'; readonly clientId: string; readonly name: string; readonly phone: string }

export type NewBooking = {
  readonly barberId: string
  readonly startsAt: Date
  readonly endsAt: Date
  readonly totalPrice: number
  readonly totalDurationMin: number
  readonly source: BookingSource
  readonly manageToken: string
  readonly client: BookingClientRef
  readonly services: readonly BookingServiceDto[]
}

export type NewReview = {
  readonly bookingId: string
  readonly barberId: string
  readonly clientId: string
  readonly rating: number
  readonly comment: string | null
  readonly isPublic: boolean
}

export type TelegramClientInput = { readonly telegramId: bigint; readonly name: string }

export interface CatalogRepository {
  listActiveServices(): Promise<ServiceRecord[]>
  findServicesByIds(ids: readonly string[]): Promise<ServiceRecord[]>
  listActiveBarberProfiles(): Promise<BarberProfile[]>
  findBarberProfile(id: string): Promise<BarberProfile | null>
  /** Активные барберы; ids = undefined — все. */
  listActiveBarbers(ids?: readonly string[]): Promise<BarberRecord[]>
  listBarberServiceLinks(serviceIds: readonly string[]): Promise<BarberServiceLink[]>
}

export interface ScheduleRepository {
  listWorkingHours(barberIds: readonly string[]): Promise<BarberWeeklyRange[]>
  listBreaks(barberIds: readonly string[]): Promise<BarberWeeklyRange[]>
  /** Исключения барберов и закрытия всего салона, пересекающиеся с [from, to). */
  listTimeOff(barberIds: readonly string[], from: Date, to: Date): Promise<TimeOffRecord[]>
  /** Подтверждённые записи, пересекающиеся с [from, to), кроме excludeBookingId. */
  listConfirmedBookings(
    barberIds: readonly string[],
    from: Date,
    to: Date,
    excludeBookingId?: string,
  ): Promise<BusyRecord[]>
}

export interface SettingsRepository {
  /** Все строки settings как key → value (jsonb). */
  getAll(): Promise<Record<string, unknown>>
}

export interface BookingRepository {
  /** Создаёт клиента (если нужно), запись и снимок услуг в одной транзакции. */
  create(input: NewBooking): Promise<BookingRecord>
  findByToken(token: string): Promise<BookingRecord | null>
  listByClient(clientId: string, limit: number): Promise<BookingRecord[]>
  /** Отменяет, только если запись ещё confirmed. null — статус уже изменился. */
  cancel(id: string): Promise<BookingRecord | null>
  /**
   * Переносит confirmed-запись и сбрасывает reminder_day_sent_at / reminder_30m_sent_at,
   * чтобы напоминания пришли к новому времени. null — запись уже не confirmed.
   */
  reschedule(id: string, startsAt: Date, endsAt: Date): Promise<BookingRecord | null>
}

export interface ClientRepository {
  findOrCreateByTelegram(input: TelegramClientInput): Promise<ClientRecord>
}

export interface ReviewRepository {
  listPublic(minRating: number, limit: number): Promise<PublicReviewDto[]>
  existsForBooking(bookingId: string): Promise<boolean>
  create(input: NewReview): Promise<{ id: string }>
}

/** Одноразовый код привязки барбера к Telegram (таблица barber_link_codes). */
export type NewBarberLinkCode = { readonly code: string; readonly barberId: string; readonly expiresAt: Date }

/** Используется createBarberLinkCode (src/telegram/link-codes.ts). */
export interface BarberLinkCodeRepository {
  create(input: NewBarberLinkCode): Promise<void>
}

/** Все репозитории, которые получает приложение. */
export type Repositories = {
  readonly catalog: CatalogRepository
  readonly schedule: ScheduleRepository
  readonly settings: SettingsRepository
  readonly bookings: BookingRepository
  readonly clients: ClientRepository
  readonly reviews: ReviewRepository
  /** Есть в продакшене (Prisma); необязателен, чтобы тестовые подделки не обязаны были его реализовывать. */
  readonly barberLinkCodes?: BarberLinkCodeRepository
}
