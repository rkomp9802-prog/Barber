import type {
  AnalyticsQuery,
  CancellationsAnalyticsDto,
  HeatmapAnalyticsDto,
  LoadAnalyticsDto,
  RetentionAnalyticsDto,
  RevenueAnalyticsDto,
  ServicesAnalyticsDto,
} from '@barber/shared'
import { AppError } from '../../errors'
import { loadRules } from '../../services/context'
import { DAY_MS, dayBoundsUtc, isValidDateKey } from '../../domain/time'
import {
  cancellationsOf,
  completedClientIds,
  heatmapOf,
  loadOf,
  retentionOf,
  revenueOf,
  servicesOf,
} from '../domain/analytics'
import type { AnalyticsBooking } from '../repositories/types'
import type { AdminContext } from './context'

/** Самый длинный период аналитики — год с запасом на високосный. */
export const MAX_ANALYTICS_DAYS = 366

type Period = { readonly from: Date; readonly to: Date; readonly timezone: string }

/** from/to — местные даты салона включительно → полуоткрытый интервал UTC [from 00:00, to+1 00:00). */
async function periodOf(ctx: AdminContext, query: AnalyticsQuery): Promise<Period> {
  if (!isValidDateKey(query.from) || !isValidDateKey(query.to)) {
    throw new AppError('VALIDATION_ERROR', 'Несуществующая дата периода')
  }
  if (query.from > query.to) throw new AppError('VALIDATION_ERROR', 'Начало периода позже конца')
  const { timezone } = await loadRules(ctx.core)
  const start = dayBoundsUtc(query.from, timezone).start
  const end = dayBoundsUtc(query.to, timezone).end
  if (end - start > MAX_ANALYTICS_DAYS * DAY_MS) {
    throw new AppError('VALIDATION_ERROR', `Период не может быть длиннее ${MAX_ANALYTICS_DAYS} дней`)
  }
  return { from: new Date(start), to: new Date(end), timezone }
}

async function bookingsOf(ctx: AdminContext, period: Period): Promise<AnalyticsBooking[]> {
  return ctx.admin.analytics.listBookings(period.from, period.to)
}

export async function revenueAnalytics(ctx: AdminContext, query: AnalyticsQuery): Promise<RevenueAnalyticsDto> {
  return revenueOf(await bookingsOf(ctx, await periodOf(ctx, query)))
}

export async function servicesAnalytics(ctx: AdminContext, query: AnalyticsQuery): Promise<ServicesAnalyticsDto> {
  return servicesOf(await bookingsOf(ctx, await periodOf(ctx, query)))
}

export async function loadAnalytics(ctx: AdminContext, query: AnalyticsQuery): Promise<LoadAnalyticsDto> {
  return loadOf(await bookingsOf(ctx, await periodOf(ctx, query)))
}

export async function cancellationsAnalytics(ctx: AdminContext, query: AnalyticsQuery): Promise<CancellationsAnalyticsDto> {
  return cancellationsOf(await bookingsOf(ctx, await periodOf(ctx, query)))
}

export async function heatmapAnalytics(ctx: AdminContext, query: AnalyticsQuery): Promise<HeatmapAnalyticsDto> {
  const period = await periodOf(ctx, query)
  return heatmapOf(await bookingsOf(ctx, period), period.timezone)
}

export async function retentionAnalytics(ctx: AdminContext, query: AnalyticsQuery): Promise<RetentionAnalyticsDto> {
  const period = await periodOf(ctx, query)
  const clientIds = completedClientIds(await bookingsOf(ctx, period))
  if (clientIds.length === 0) return retentionOf([])
  return retentionOf(await ctx.admin.analytics.clientVisitStats(clientIds, period.to))
}
