import type { BookingSource, BookingStatus, TimeOffType, WeeklyRangeDto } from '@barber/shared'
import type { BookingRecord } from '../../repositories/types'

/**
 * Доступ к данным админки. Маршруты и сервисы зависят только от этих интерфейсов:
 * в продакшене — Prisma (./prisma), в тестах — in-memory подделки (test/admin/fakes).
 */

/* ---------- Авторизация ---------- */

export type AdminUserRecord = { readonly id: string; readonly login: string; readonly passwordHash: string }

export type AdminSessionRecord = {
  readonly adminUserId: string
  readonly login: string
  readonly expiresAt: Date
}

export type NewAdminSession = { readonly adminUserId: string; readonly tokenHash: string; readonly expiresAt: Date }

export interface AdminAuthRepository {
  findUserByLogin(login: string): Promise<AdminUserRecord | null>
  createSession(input: NewAdminSession): Promise<void>
  /** Только действующая (expiresAt > now) сессия. */
  findActiveSession(tokenHash: string, now: Date): Promise<AdminSessionRecord | null>
  deleteSession(tokenHash: string): Promise<void>
  /** Чистит истёкшие сессии администратора (вызывается при входе). */
  deleteExpiredSessions(adminUserId: string, now: Date): Promise<void>
}

/* ---------- Услуги ---------- */

export type AdminServiceRecord = {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly durationMin: number
  readonly price: number
  readonly isActive: boolean
  readonly sortOrder: number
}

export type AdminServiceData = Omit<AdminServiceRecord, 'id'>

export interface AdminServiceRepository {
  list(): Promise<AdminServiceRecord[]>
  findById(id: string): Promise<AdminServiceRecord | null>
  create(data: AdminServiceData): Promise<AdminServiceRecord>
  update(id: string, patch: Partial<AdminServiceData>): Promise<AdminServiceRecord | null>
}

/* ---------- Барберы ---------- */

export type AdminBarberData = {
  readonly name: string
  readonly role: string
  readonly bio: string
  readonly photoUrl: string | null
  readonly experienceYears: number
  readonly isActive: boolean
  readonly sortOrder: number
}

export type AdminBarberLinkRecord = {
  readonly serviceId: string
  readonly serviceName: string
  readonly serviceDurationMin: number
  readonly servicePrice: number
  readonly isEnabled: boolean
  readonly durationMin: number | null
  readonly price: number | null
}

export type PortfolioItemRecord = { readonly id: string; readonly imageUrl: string; readonly sortOrder: number }

/** Барбер со всем, что показывает админка. */
export type AdminBarberRecord = AdminBarberData & {
  readonly id: string
  readonly telegramLinked: boolean
  readonly services: readonly AdminBarberLinkRecord[]
  readonly portfolio: readonly PortfolioItemRecord[]
  readonly workingHours: readonly WeeklyRangeDto[]
  readonly breaks: readonly WeeklyRangeDto[]
}

export type BarberServiceSetting = {
  readonly serviceId: string
  readonly isEnabled: boolean
  readonly durationMin: number | null
  readonly price: number | null
}

export type WeeklySchedule = {
  readonly workingHours: readonly WeeklyRangeDto[]
  readonly breaks: readonly WeeklyRangeDto[]
}

export interface AdminBarberRepository {
  list(): Promise<AdminBarberRecord[]>
  findById(id: string): Promise<AdminBarberRecord | null>
  create(data: AdminBarberData): Promise<AdminBarberRecord>
  update(id: string, patch: Partial<AdminBarberData>): Promise<AdminBarberRecord | null>
  /** Заменяет все связи барбер ↔ услуга. */
  replaceServices(id: string, services: readonly BarberServiceSetting[]): Promise<void>
  /** Заменяет недельный график и обеды в одной транзакции. */
  replaceSchedule(id: string, schedule: WeeklySchedule): Promise<void>
  addPortfolioItem(barberId: string, imageUrl: string): Promise<PortfolioItemRecord>
  /** false — портфолио с таким id не найдено. */
  deletePortfolioItem(itemId: string): Promise<boolean>
  /** Проставляет sort_order = индекс в itemIds. */
  reorderPortfolio(barberId: string, itemIds: readonly string[]): Promise<PortfolioItemRecord[]>
}

/* ---------- Исключения ---------- */

export type AdminTimeOffData = {
  readonly barberId: string | null
  readonly startsAt: Date
  readonly endsAt: Date
  readonly type: TimeOffType
  readonly note: string | null
}

export type AdminTimeOffRecord = AdminTimeOffData & { readonly id: string; readonly barberName: string | null }

export type TimeOffFilter = {
  readonly from?: Date
  readonly to?: Date
  /** undefined — все; null — только исключения всего салона. */
  readonly barberId?: string | null
}

export interface AdminTimeOffRepository {
  list(filter: TimeOffFilter): Promise<AdminTimeOffRecord[]>
  findById(id: string): Promise<AdminTimeOffRecord | null>
  create(data: AdminTimeOffData): Promise<AdminTimeOffRecord>
  update(id: string, data: AdminTimeOffData): Promise<AdminTimeOffRecord | null>
  delete(id: string): Promise<boolean>
}

/* ---------- Записи ---------- */

export type BookingFilter = {
  readonly from?: Date
  readonly to?: Date
  readonly barberId?: string
  readonly statuses?: readonly BookingStatus[]
  readonly source?: BookingSource
  /** Подстрока имени (без учёта регистра) или цифры телефона. */
  readonly search?: string
  readonly order: 'asc' | 'desc'
  readonly offset: number
  readonly limit: number
}

export interface AdminBookingRepository {
  list(filter: BookingFilter): Promise<{ items: BookingRecord[]; total: number }>
  findById(id: string): Promise<BookingRecord | null>
  /** Подтверждённые записи, пересекающиеся с [from, to); barberId = null — у всех барберов. */
  listConfirmedOverlapping(barberId: string | null, from: Date, to: Date): Promise<BookingRecord[]>
  /** Меняет статус, только если текущий входит в from. null — статус уже другой. */
  setStatus(id: string, from: readonly BookingStatus[], to: BookingStatus): Promise<BookingRecord | null>
}

/* ---------- Отзывы ---------- */

export type AdminReviewRecord = {
  readonly id: string
  readonly bookingId: string
  readonly bookingStartsAt: Date
  readonly barberId: string
  readonly barberName: string
  readonly clientName: string
  readonly clientPhone: string | null
  readonly rating: number
  readonly comment: string | null
  readonly isPublic: boolean
  readonly createdAt: Date
}

export type ReviewFilter = {
  readonly barberId?: string
  readonly isPublic?: boolean
  readonly minRating?: number
  readonly maxRating?: number
  readonly offset: number
  readonly limit: number
}

export interface AdminReviewRepository {
  list(filter: ReviewFilter): Promise<{ items: AdminReviewRecord[]; total: number }>
  setPublic(id: string, isPublic: boolean): Promise<AdminReviewRecord | null>
}

/* ---------- Настройки ---------- */

export interface AdminSettingsRepository {
  getAll(): Promise<Record<string, unknown>>
  /** upsert каждого ключа в одной транзакции. */
  upsertMany(values: Readonly<Record<string, string | number>>): Promise<void>
}

/* ---------- Аналитика ---------- */

export type AnalyticsBooking = {
  readonly id: string
  readonly barberId: string
  readonly clientId: string
  readonly status: BookingStatus
  readonly startsAt: Date
  readonly endsAt: Date
  readonly totalPrice: number
  readonly services: readonly { readonly serviceId: string; readonly name: string; readonly price: number }[]
}

export type ClientVisitStat = {
  readonly clientId: string
  /** Первый completed-визит за всё время (до before). */
  readonly firstVisitAt: Date
  /** Число completed-визитов до before. */
  readonly visits: number
}

export interface AnalyticsRepository {
  /** Все записи, у которых starts_at ∈ [from, to). */
  listBookings(from: Date, to: Date): Promise<AnalyticsBooking[]>
  /** Статистика completed-визитов клиентов с starts_at < before. */
  clientVisitStats(clientIds: readonly string[], before: Date): Promise<ClientVisitStat[]>
}

export type AdminRepositories = {
  readonly auth: AdminAuthRepository
  readonly services: AdminServiceRepository
  readonly barbers: AdminBarberRepository
  readonly timeOff: AdminTimeOffRepository
  readonly bookings: AdminBookingRepository
  readonly reviews: AdminReviewRepository
  readonly settings: AdminSettingsRepository
}
