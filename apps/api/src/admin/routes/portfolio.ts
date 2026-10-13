import {
  adminPortfolioCreateSchema,
  adminPortfolioOrderSchema,
  adminUploadSchema,
} from '@barber/shared'
import type { FastifyInstance } from 'fastify'
import { addPortfolioItem, deletePortfolioItem, reorderPortfolio } from '../services/portfolio'
import type { AdminContext } from '../services/context'
import { createUploadTarget } from '../services/uploads'
import { paramId } from './params'

/** Портфолио барбера и выдача подписанного URL для загрузки фото (Supabase Storage). */
export async function adminPortfolioRoutes(app: FastifyInstance, ctx: AdminContext): Promise<void> {
  app.post('/uploads', async request =>
    createUploadTarget(ctx.config.storage, adminUploadSchema.parse(request.body)),
  )

  app.post('/barbers/:id/portfolio', async (request, reply) => {
    const input = adminPortfolioCreateSchema.parse(request.body)
    reply.status(201)
    return addPortfolioItem(ctx, paramId(request), input.imageUrl)
  })

  app.put('/barbers/:id/portfolio/order', async request =>
    reorderPortfolio(ctx, paramId(request), adminPortfolioOrderSchema.parse(request.body).itemIds),
  )

  app.delete('/portfolio/:id', async (request, reply) => {
    await deletePortfolioItem(ctx, paramId(request))
    return reply.status(204).send()
  })
}
