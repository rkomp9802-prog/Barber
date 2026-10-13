import {
  availabilityDaysQuerySchema,
  availabilityQuerySchema,
  type AvailabilityDaysResponse,
  type AvailabilityResponse,
} from '@barber/shared'
import type { FastifyInstance } from 'fastify'
import { getAvailability, getAvailabilityDays } from '../services/availability-service'
import type { RouteDeps } from './types'

/** GET /availability и GET /availability/days — слоты считает только сервер. */
export async function availabilityRoutes(app: FastifyInstance, deps: RouteDeps): Promise<void> {
  app.get('/availability', async (request): Promise<AvailabilityResponse> => {
    const query = availabilityQuerySchema.parse(request.query)
    return getAvailability(deps.ctx, query)
  })

  app.get('/availability/days', async (request): Promise<AvailabilityDaysResponse> => {
    const query = availabilityDaysQuerySchema.parse(request.query)
    return getAvailabilityDays(deps.ctx, query)
  })
}
