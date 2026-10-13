import { z } from 'zod'

/**
 * Контракт аналитики GET /api/v1/admin/analytics/* (spec-final.md §8, tasks-final.md этап 10).
 * Все эндпоинты требуют admin-сессию.
 */

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Дата должна быть в формате YYYY-MM-DD')

/** Общий query для всех analytics endpoints: период from/to. */
export const analyticsQuerySchema = z.object({
  from: dateKey,
  to: dateKey,
})
export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>

/* ---------- Выручка ---------- */

/** GET /admin/analytics/revenue?from=...&to=... */
export type RevenueAnalyticsDto = {
  /** Выручка по completed-записям за период. */
  totalRevenue: number
  /** Количество completed записей. */
  completedCount: number
  /** Средний чек. */
  averageCheck: number
}

/* ---------- Популярные услуги ---------- */

/** GET /admin/analytics/services?from=...&to=... */
export type ServiceStatsDto = {
  serviceId: string
  serviceName: string
  /** Сколько раз услуга была в записях (completed). */
  bookingsCount: number
  /** Доля от всех услуг (0-100%). */
  sharePercent: number
}

export type ServicesAnalyticsDto = {
  services: ServiceStatsDto[]
}

/* ---------- Загрузка барберов ---------- */

/** GET /admin/analytics/load?from=...&to=... */
export type BarberLoadDto = {
  barberId: string
  barberName: string
  /** Общее время completed записей (минуты). */
  workedMinutes: number
  /** Количество completed записей. */
  completedCount: number
  /** Выручка этого барбера. */
  revenue: number
}

export type LoadAnalyticsDto = {
  barbers: BarberLoadDto[]
}

/* ---------- Отмены и неявки ---------- */

/** GET /admin/analytics/cancellations?from=...&to=... */
export type CancellationsAnalyticsDto = {
  /** Количество отменённых записей (status = cancelled). */
  cancelledCount: number
  /** Количество неявок (status = no_show). */
  noShowCount: number
  /** Общее количество записей за период. */
  totalBookings: number
  /** Процент отмен от всех. */
  cancelledPercent: number
  /** Процент неявок от всех. */
  noShowPercent: number
}

/* ---------- Возвращаемость ---------- */

/** GET /admin/analytics/retention?from=...&to=... */
export type RetentionAnalyticsDto = {
  /** Клиенты, которые пришли 1 раз. */
  oneTimeClients: number
  /** Клиенты, которые пришли 2+ раза. */
  returningClients: number
  /** Процент возвращаемости. */
  retentionRate: number
}

/* ---------- Heatmap ---------- */

/** GET /admin/analytics/heatmap?from=...&to=... */
export type HeatmapCellDto = {
  /** День недели 0-6 (0 = понедельник). */
  dayOfWeek: number
  /** Час 0-23. */
  hour: number
  /** Количество completed записей в этот день недели + час. */
  bookingsCount: number
}

export type HeatmapAnalyticsDto = {
  cells: HeatmapCellDto[]
}
