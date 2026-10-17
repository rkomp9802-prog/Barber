import type { BookingStatus } from '@barber/shared'
import type { Db } from '../../../db/prisma'
import type { AnalyticsBooking, AnalyticsRepository, ClientVisitStat } from '../types'

export class PrismaAnalyticsRepository implements AnalyticsRepository {
  constructor(private readonly db: Db) {}

  async listBookings(from: Date, to: Date): Promise<AnalyticsBooking[]> {
    const rows = await this.db.booking.findMany({
      where: { startsAt: { gte: from, lt: to } },
      select: {
        id: true,
        barberId: true,
        clientId: true,
        status: true,
        startsAt: true,
        endsAt: true,
        totalPrice: true,
        barber: { select: { name: true } },
        services: { select: { serviceId: true, name: true, price: true } },
      },
      orderBy: { startsAt: 'asc' },
    })
    return rows.map(row => ({
      id: row.id,
      barberId: row.barberId,
      barberName: row.barber.name,
      clientId: row.clientId,
      status: row.status as BookingStatus,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      totalPrice: row.totalPrice,
      services: row.services,
    }))
  }

  /** Визиты считаем по человеку (телефону): гость с сайта каждый раз — новая строка clients. */
  async clientVisitStats(clientIds: readonly string[], before: Date): Promise<ClientVisitStat[]> {
    const rows = await this.db.$queryRaw<{ client_key: string; visits: number; first_visit_at: Date }[]>`
      WITH targets AS (
        SELECT DISTINCT COALESCE(phone, id::text) AS client_key FROM clients WHERE id = ANY(${[...clientIds]}::uuid[])
      )
      SELECT COALESCE(c.phone, c.id::text) AS client_key, count(*)::int AS visits, min(b.starts_at) AS first_visit_at
      FROM bookings b
      JOIN clients c ON c.id = b.client_id
      WHERE b.status = 'completed' AND b.starts_at < ${before}
        AND COALESCE(c.phone, c.id::text) IN (SELECT client_key FROM targets)
      GROUP BY 1`
    return rows.map(row => ({ clientKey: row.client_key, firstVisitAt: row.first_visit_at, visits: row.visits }))
  }
}
