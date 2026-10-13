import {
  adminReviewUpdateSchema,
  adminReviewsQuerySchema,
  adminSettingsSchema,
} from '@barber/shared'
import type { FastifyInstance } from 'fastify'
import type { AdminContext } from '../services/context'
import { listReviews, updateReview, getSettings, updateSettings } from '../services/reviews-settings'
import { paramId } from './params'

/** Отзывы: список с фильтрами и переключение публичности. */
export async function adminReviewRoutes(app: FastifyInstance, ctx: AdminContext): Promise<void> {
  app.get('/reviews', async request => listReviews(ctx, adminReviewsQuerySchema.parse(request.query)))

  app.patch('/reviews/:id', async request =>
    updateReview(ctx, paramId(request), adminReviewUpdateSchema.parse(request.body)),
  )
}

/** Настройки: GET отдаёт все ключи, PUT принимает подмножество (неизвестные ключи → 422). */
export async function adminSettingsRoutes(app: FastifyInstance, ctx: AdminContext): Promise<void> {
  app.get('/settings', async () => getSettings(ctx))

  app.put('/settings', async request => updateSettings(ctx, adminSettingsSchema.parse(request.body)))
}
