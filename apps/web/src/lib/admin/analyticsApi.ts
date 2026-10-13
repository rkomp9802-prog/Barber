import type {
  CancellationsAnalyticsDto,
  HeatmapAnalyticsDto,
  LoadAnalyticsDto,
  RetentionAnalyticsDto,
  RevenueAnalyticsDto,
  ServicesAnalyticsDto,
} from '@barber/shared'

import type { DateRange } from './analyticsPeriod'
import { adminJson, toQueryString } from './request'

/*
 * Админский API аналитики: шесть GET-эндпоинтов с одинаковым периодом from/to (включительно, по Ташкенту).
 * Типы ответов — packages/shared/src/analytics-api.ts.
 */

export type AnalyticsData = {
  revenue: RevenueAnalyticsDto
  services: ServicesAnalyticsDto
  load: LoadAnalyticsDto
  cancellations: CancellationsAnalyticsDto
  retention: RetentionAnalyticsDto
  heatmap: HeatmapAnalyticsDto
}

function periodQuery(range: DateRange): string {
  return toQueryString({ from: range.from, to: range.to })
}

export function getRevenueAnalytics(range: DateRange): Promise<RevenueAnalyticsDto> {
  return adminJson<RevenueAnalyticsDto>('/analytics/revenue', { query: periodQuery(range) })
}

export function getServicesAnalytics(range: DateRange): Promise<ServicesAnalyticsDto> {
  return adminJson<ServicesAnalyticsDto>('/analytics/services', { query: periodQuery(range) })
}

export function getLoadAnalytics(range: DateRange): Promise<LoadAnalyticsDto> {
  return adminJson<LoadAnalyticsDto>('/analytics/load', { query: periodQuery(range) })
}

export function getCancellationsAnalytics(range: DateRange): Promise<CancellationsAnalyticsDto> {
  return adminJson<CancellationsAnalyticsDto>('/analytics/cancellations', { query: periodQuery(range) })
}

export function getRetentionAnalytics(range: DateRange): Promise<RetentionAnalyticsDto> {
  return adminJson<RetentionAnalyticsDto>('/analytics/retention', { query: periodQuery(range) })
}

export function getHeatmapAnalytics(range: DateRange): Promise<HeatmapAnalyticsDto> {
  return adminJson<HeatmapAnalyticsDto>('/analytics/heatmap', { query: periodQuery(range) })
}

/** Все шесть запросов параллельно; падает, если упал любой из них. */
export async function loadAnalytics(range: DateRange): Promise<AnalyticsData> {
  const [revenue, services, load, cancellations, retention, heatmap] = await Promise.all([
    getRevenueAnalytics(range),
    getServicesAnalytics(range),
    getLoadAnalytics(range),
    getCancellationsAnalytics(range),
    getRetentionAnalytics(range),
    getHeatmapAnalytics(range),
  ])
  return { revenue, services, load, cancellations, retention, heatmap }
}
