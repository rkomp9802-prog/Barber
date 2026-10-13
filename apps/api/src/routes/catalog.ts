import type { BarberDto, ServiceDto } from '@barber/shared'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { AppError } from '../errors'
import { toBarberDto, toServiceDto } from '../services/mappers'
import type { RouteDeps } from './types'

const barberParamsSchema = z.object({ id: z.string() })
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** GET /services, GET /barbers, GET /barbers/:id */
export async function catalogRoutes(app: FastifyInstance, deps: RouteDeps): Promise<void> {
  const { repos } = deps.ctx

  app.get('/services', async (): Promise<ServiceDto[]> => {
    const services = await repos.catalog.listActiveServices()
    return services.map(toServiceDto)
  })

  app.get('/barbers', async (): Promise<BarberDto[]> => {
    const barbers = await repos.catalog.listActiveBarberProfiles()
    return barbers.map(toBarberDto)
  })

  app.get('/barbers/:id', async (request): Promise<BarberDto> => {
    const { id } = barberParamsSchema.parse(request.params)
    const barber = UUID_PATTERN.test(id) ? await repos.catalog.findBarberProfile(id) : null
    if (!barber) throw new AppError('NOT_FOUND', 'Барбер не найден')
    return toBarberDto(barber)
  })
}
