import type { Db } from '../../db/prisma'
import type { BarberWeeklyRange, BusyRecord, ScheduleRepository, TimeOffRecord } from '../types'
import { liveBookingWhere } from './bookings'

type RangeRow = { barberId: string; weekday: number; startTime: string; endTime: string }

function toRange(row: RangeRow): BarberWeeklyRange {
  return { barberId: row.barberId, weekday: row.weekday, startTime: row.startTime, endTime: row.endTime }
}

export class PrismaScheduleRepository implements ScheduleRepository {
  constructor(private readonly db: Db) {}

  async listWorkingHours(barberIds: readonly string[]): Promise<BarberWeeklyRange[]> {
    const rows = await this.db.workingHour.findMany({ where: { barberId: { in: [...barberIds] } } })
    return rows.map(toRange)
  }

  async listBreaks(barberIds: readonly string[]): Promise<BarberWeeklyRange[]> {
    const rows = await this.db.break.findMany({ where: { barberId: { in: [...barberIds] } } })
    return rows.map(toRange)
  }

  async listTimeOff(barberIds: readonly string[], from: Date, to: Date): Promise<TimeOffRecord[]> {
    const rows = await this.db.timeOff.findMany({
      where: {
        OR: [{ barberId: null }, { barberId: { in: [...barberIds] } }],
        startsAt: { lt: to },
        endsAt: { gt: from },
      },
      select: { barberId: true, startsAt: true, endsAt: true },
    })
    return rows
  }

  async listBusyBookings(
    barberIds: readonly string[],
    from: Date,
    to: Date,
    now: Date,
    excludeBookingId?: string,
  ): Promise<BusyRecord[]> {
    const rows = await this.db.booking.findMany({
      where: {
        barberId: { in: [...barberIds] },
        ...liveBookingWhere(now),
        startsAt: { lt: to },
        endsAt: { gt: from },
        ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
      },
      select: { barberId: true, startsAt: true, endsAt: true },
    })
    return rows
  }
}
