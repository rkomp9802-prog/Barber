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

  async clientVisitStats(clientIds: readonly string[], before: Date): Promise<ClientVisitStat[]> {
    const rows = await this.db.booking.groupBy({
      by: ['clientId'],
      where: { clientId: { in: [...clientIds] }, status: 'completed', startsAt: { lt: before } },
      _count: { _all: true },
      _min: { startsAt: true },
    })
    return rows.flatMap(row =>
      row._min.startsAt ? [{ clientId: row.clientId, firstVisitAt: row._min.startsAt, visits: row._count._all }] : [],
    )
  }
}
