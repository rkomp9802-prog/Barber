import {
  adminBookingCreateSchema,
  adminBookingUpdateSchema,
  adminBookingsQuerySchema,
} from '@barber/shared'
import type { FastifyInstance } from 'fastify'
import { createManualBooking, getBooking, listBookings, listTodayBookings, updateBooking } from '../services/bookings'
import type { AdminContext } from '../services/context'
import { paramId } from './params'

/** Записи администратора: список, сегодня, ручная запись, смена статуса и перенос. */
export async function adminBookingRoutes(app: FastifyInstance, ctx: AdminContext): Promise<void> {
  app.get('/bookings', async request => listBookings(ctx, adminBookingsQuerySchema.parse(request.query)))

  app.get('/bookings/today', async () => listTodayBookings(ctx))

  app.get('/bookings/:id', async request => getBooking(ctx, paramId(request)))

  app.post('/bookings', async (request, reply) => {
    const input = adminBookingCreateSchema.parse(request.body)
    reply.status(201)
    return createManualBooking(ctx, input)
  })

  app.patch('/bookings/:id', async request =>
    updateBooking(ctx, request, paramId(request), adminBookingUpdateSchema.parse(request.body)),
  )
}
