import { createBookingSchema, rescheduleBookingSchema, type BookingDto, type MeDto } from '@barber/shared'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { requireTelegramClient, resolveTelegramClient } from '../auth/telegram-client'
import {
  cancelBooking,
  createBooking,
  getBookingByToken,
  listClientBookings,
  rescheduleBooking,
} from '../services/booking-service'
import type { RouteDeps } from './types'

const tokenParamsSchema = z.object({ token: z.string().max(200) })
const ONE_MINUTE = '1 minute'
const TOKEN_ROUTE_RATE_LIMIT = 30

/** Создание, просмотр, отмена и перенос записи; «Мои записи» для Mini App. */
export async function bookingRoutes(app: FastifyInstance, deps: RouteDeps): Promise<void> {
  const { ctx, telegram } = deps
  const tokenLimit = { rateLimit: { max: TOKEN_ROUTE_RATE_LIMIT, timeWindow: ONE_MINUTE } }

  app.post(
    '/bookings',
    { config: { rateLimit: { max: deps.bookingRateLimitMax, timeWindow: ONE_MINUTE } } },
    async (request, reply): Promise<BookingDto> => {
      const input = createBookingSchema.parse(request.body)
      const client = await resolveTelegramClient(request, telegram, ctx.repos.clients, ctx.now())
      const booking = await createBooking(ctx, request, input, client)
      reply.status(201)
      return booking
    },
  )

  app.get('/bookings/:token', { config: tokenLimit }, async (request): Promise<BookingDto> => {
    const { token } = tokenParamsSchema.parse(request.params)
    return getBookingByToken(ctx, token)
  })

  app.post('/bookings/:token/cancel', { config: tokenLimit }, async (request): Promise<BookingDto> => {
    const { token } = tokenParamsSchema.parse(request.params)
    return cancelBooking(ctx, request, token)
  })

  app.post('/bookings/:token/reschedule', { config: tokenLimit }, async (request): Promise<BookingDto> => {
    const { token } = tokenParamsSchema.parse(request.params)
    const { startsAt } = rescheduleBookingSchema.parse(request.body)
    return rescheduleBooking(ctx, request, token, startsAt)
  })

  app.get('/me/bookings', async (request): Promise<BookingDto[]> => {
    const client = await requireTelegramClient(request, telegram, ctx.repos.clients, ctx.now())
    return listClientBookings(ctx, client)
  })

  /** Профиль клиента Mini App: подтверждён ли номер (кнопка «Поделиться номером»). */
  app.get('/me', async (request): Promise<MeDto> => {
    const client = await requireTelegramClient(request, telegram, ctx.repos.clients, ctx.now())
    const verified = client.phoneVerifiedAt !== null && client.phone !== null
    return { name: client.name, phone: verified ? client.phone : null, phoneVerified: verified }
  })
}
