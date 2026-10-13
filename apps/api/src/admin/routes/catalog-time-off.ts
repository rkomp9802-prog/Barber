import {
  adminServiceCreateSchema,
  adminServiceUpdateSchema,
  adminTimeOffCreateSchema,
  adminTimeOffQuerySchema,
  adminTimeOffUpdateSchema,
} from '@barber/shared'
import type { FastifyInstance } from 'fastify'
import { createService, deactivateService, listServices, updateService } from '../services/catalog'
import type { AdminContext } from '../services/context'
import { createTimeOff, deleteTimeOff, listTimeOff, updateTimeOff } from '../services/time-off'
import { paramId } from './params'

/** Услуги каталога: CRUD, DELETE = is_active=false. */
export async function adminServiceRoutes(app: FastifyInstance, ctx: AdminContext): Promise<void> {
  app.get('/services', async () => listServices(ctx))

  app.post('/services', async (request, reply) => {
    const input = adminServiceCreateSchema.parse(request.body)
    reply.status(201)
    return createService(ctx, input)
  })

  app.patch('/services/:id', async request =>
    updateService(ctx, paramId(request), adminServiceUpdateSchema.parse(request.body)),
  )

  app.delete('/services/:id', async request => deactivateService(ctx, paramId(request)))
}

/** Исключения: выходные, отпуска, закрытие салона. Записи в них не отменяются, а возвращаются в conflicts. */
export async function adminTimeOffRoutes(app: FastifyInstance, ctx: AdminContext): Promise<void> {
  app.get('/time-off', async request => listTimeOff(ctx, adminTimeOffQuerySchema.parse(request.query)))

  app.post('/time-off', async (request, reply) => {
    const input = adminTimeOffCreateSchema.parse(request.body)
    reply.status(201)
    return createTimeOff(ctx, input)
  })

  app.patch('/time-off/:id', async request =>
    updateTimeOff(ctx, paramId(request), adminTimeOffUpdateSchema.parse(request.body)),
  )

  app.delete('/time-off/:id', async (request, reply) => {
    await deleteTimeOff(ctx, paramId(request))
    return reply.status(204).send()
  })
}
