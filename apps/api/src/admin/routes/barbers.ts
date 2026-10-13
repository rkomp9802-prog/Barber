import {
  adminBarberCreateSchema,
  adminBarberServicesSchema,
  adminBarberUpdateSchema,
  adminScheduleSchema,
} from '@barber/shared'
import type { FastifyInstance } from 'fastify'
import {
  createBarber,
  deactivateBarber,
  getBarber,
  listBarbers,
  updateBarber,
} from '../services/barbers'
import { replaceBarberSchedule, replaceBarberServices, issueBarberLinkCode } from '../services/barber-schedule'
import type { AdminContext } from '../services/context'
import { paramId } from './params'

/** Барберы: CRUD (DELETE = is_active=false), услуги, график и ссылка привязки Telegram. */
export async function adminBarberRoutes(app: FastifyInstance, ctx: AdminContext): Promise<void> {
  app.get('/barbers', async () => listBarbers(ctx))

  app.get('/barbers/:id', async request => getBarber(ctx, paramId(request)))

  app.post('/barbers', async (request, reply) => {
    const input = adminBarberCreateSchema.parse(request.body)
    reply.status(201)
    return createBarber(ctx, input)
  })

  app.patch('/barbers/:id', async request =>
    updateBarber(ctx, paramId(request), adminBarberUpdateSchema.parse(request.body)),
  )

  app.delete('/barbers/:id', async request => deactivateBarber(ctx, paramId(request)))

  app.put('/barbers/:id/services', async request =>
    replaceBarberServices(ctx, paramId(request), adminBarberServicesSchema.parse(request.body)),
  )

  app.put('/barbers/:id/schedule', async request =>
    replaceBarberSchedule(ctx, paramId(request), adminScheduleSchema.parse(request.body)),
  )

  app.post('/barbers/:id/link-code', async request => issueBarberLinkCode(ctx, paramId(request)))
}
