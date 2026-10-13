import { analyticsQuerySchema } from '@barber/shared'
import type { FastifyInstance } from 'fastify'
import type { AdminContext } from '../services/context'
import {
  cancellationsAnalytics,
  heatmapAnalytics,
  loadAnalytics,
  retentionAnalytics,
  revenueAnalytics,
  servicesAnalytics,
} from '../services/analytics'

/** Аналитика за период ?from=YYYY-MM-DD&to=YYYY-MM-DD (даты салона, включительно). */
export async function adminAnalyticsRoutes(app: FastifyInstance, ctx: AdminContext): Promise<void> {
  const query = (raw: unknown) => analyticsQuerySchema.parse(raw)

  app.get('/analytics/revenue', async request => revenueAnalytics(ctx, query(request.query)))
  app.get('/analytics/services', async request => servicesAnalytics(ctx, query(request.query)))
  app.get('/analytics/load', async request => loadAnalytics(ctx, query(request.query)))
  app.get('/analytics/cancellations', async request => cancellationsAnalytics(ctx, query(request.query)))
  app.get('/analytics/retention', async request => retentionAnalytics(ctx, query(request.query)))
  app.get('/analytics/heatmap', async request => heatmapAnalytics(ctx, query(request.query)))
}
