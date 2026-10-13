import { z } from 'zod'
import { dateKey } from './primitives'

/* ---------- Аналитика (этап 10) ---------- */
// GET /admin/analytics/{summary|revenue|services|load|heatmap|cancellations|retention}?from&to
// Период — включительно, даты по Ташкенту, не больше 366 дней. Запись попадает в период по starts_at.
// Проценты — числа 0..100 с одним знаком после запятой; при нулевом знаменателе — 0.

export const ANALYTICS_MAX_DAYS = 366

export const analyticsQuerySchema = z.object({ from: dateKey, to: dateKey })
export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>

export type AnalyticsPeriodDto = { from: string; to: string; days: number }

/** Выручка — только completed, по total_price. */
export type RevenueAnalyticsDto = {
  period: AnalyticsPeriodDto
  total: number
  completedCount: number
  /** Средний чек = total / completedCount (округлён до целого). */
  averageCheck: number
  /** Каждый день периода, включая нулевые. */
  byDay: { date: string; revenue: number; count: number }[]
}

/** Популярность услуг по снимкам booking_services записей confirmed + completed. */
export type ServicesAnalyticsDto = {
  period: AnalyticsPeriodDto
  items: { serviceId: string; name: string; count: number; revenue: number; sharePercent: number }[]
}

/**
 * Загрузка: занятые минуты (confirmed, completed, no_show) / доступные минуты
 * (график − обеды − исключения) за период.
 */
export type LoadAnalyticsDto = {
  period: AnalyticsPeriodDto
  items: { barberId: string; barberName: string; bookedMinutes: number; availableMinutes: number; loadPercent: number }[]
  total: { bookedMinutes: number; availableMinutes: number; loadPercent: number }
}

/**
 * Тепловая карта день недели × час (Ташкент) по записям confirmed, completed, no_show.
 * starts[weekday][hour] — записей, начавшихся в этот час;
 * occupied[weekday][hour] — записей, занимающих хотя бы часть этого часа.
 * weekday: 0 = воскресенье … 6 = суббота; hour: 0…23.
 */
export type HeatmapAnalyticsDto = {
  period: AnalyticsPeriodDto
  starts: number[][]
  occupied: number[][]
  maxOccupied: number
}

export type CancellationStatsDto = {
  total: number
  cancelled: number
  noShow: number
  cancelledPercent: number
  noShowPercent: number
}

/** Отмены и неявки от всех записей периода. */
export type CancellationsAnalyticsDto = {
  period: AnalyticsPeriodDto
  overall: CancellationStatsDto
  byBarber: (CancellationStatsDto & { barberId: string; barberName: string })[]
}

/**
 * Возвращаемость по completed-визитам:
 * activeClients — клиенты с ≥1 визитом в периоде;
 * repeatClients — из них те, у кого ≥2 визитов за всё время до конца периода;
 * newClients — первый визит за всё время пришёлся на период; returningClients — остальные.
 */
export type RetentionAnalyticsDto = {
  period: AnalyticsPeriodDto
  activeClients: number
  repeatClients: number
  repeatPercent: number
  newClients: number
  returningClients: number
  returningPercent: number
}

/** Карточки dashboard. */
export type SummaryAnalyticsDto = {
  period: AnalyticsPeriodDto
  /** Все записи периода (любой статус). */
  bookingsCount: number
  completedCount: number
  revenue: number
  averageCheck: number
  cancelledPercent: number
  noShowPercent: number
  returningPercent: number
}
