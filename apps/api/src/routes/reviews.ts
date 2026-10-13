import { createReviewSchema, type PublicReviewDto } from '@barber/shared'
import type { FastifyInstance } from 'fastify'
import { createReview, listPublicReviews } from '../services/review-service'
import type { RouteDeps } from './types'

const REVIEW_RATE_LIMIT = 10

/** GET /reviews/public, POST /reviews */
export async function reviewRoutes(app: FastifyInstance, deps: RouteDeps): Promise<void> {
  app.get('/reviews/public', async (): Promise<PublicReviewDto[]> => listPublicReviews(deps.ctx))

  app.post(
    '/reviews',
    { config: { rateLimit: { max: REVIEW_RATE_LIMIT, timeWindow: '1 minute' } } },
    async (request, reply): Promise<{ id: string }> => {
      const input = createReviewSchema.parse(request.body)
      const review = await createReview(deps.ctx, input)
      reply.status(201)
      return review
    },
  )
}
