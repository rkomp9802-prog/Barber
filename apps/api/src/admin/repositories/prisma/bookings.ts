import type { BookingStatus } from '@barber/shared'
import type { Db } from '../../../db/prisma'
import type { Prisma } from '../../../generated/prisma/client'
import { BOOKING_INCLUDE, toRecord } from '../../../repositories/prisma/bookings'
import type { BookingRecord } from '../../../repositories/types'
import type { AdminBookingRepository, BookingFilter } from '../types'

function searchClause(search: string): Prisma.ClientWhereInput {
  const digits = search.replace(/\D/g, '')
  return {
    OR: [
      { name: { contains: search, mode: 'insensitive' } },
      ...(digits.length > 0 ? [{ phone: { contains: digits } }] : []),
    ],
  }
}

function startsAtRange(filter: BookingFilter): Prisma.DateTimeFilter | undefined {
  if (!filter.from && !filter.to) return undefined
  return {
    ...(filter.from ? { gte: filter.from } : {}),
    ...(filter.to ? { lt: filter.to } : {}),
  }
}

function whereOf(filter: BookingFilter): Prisma.BookingWhereInput {
  const range = startsAtRange(filter)
  return {
    ...(range ? { startsAt: range } : {}),
    ...(filter.barberId ? { barberId: filter.barberId } : {}),
    ...(filter.statuses ? { status: { in: [...filter.statuses] } } : {}),
    ...(filter.source ? { source: filter.source } : {}),
    ...(filter.search ? { client: searchClause(filter.search) } : {}),
  }
}

/** Записи для админки: список, поиск и изменение статуса. Создание и перенос — через основные репозитории. */
export class PrismaAdminBookingRepository implements AdminBookingRepository {
  constructor(private readonly db: Db) {}

  async list(filter: BookingFilter): Promise<{ items: BookingRecord[]; total: number }> {
    const where = whereOf(filter)
    const [rows, total] = await this.db.$transaction([
      this.db.booking.findMany({
        where,
        include: BOOKING_INCLUDE,
        orderBy: { startsAt: filter.order },
        skip: filter.offset,
        take: filter.limit,
      }),
      this.db.booking.count({ where }),
    ])
    return { items: rows.map(toRecord), total }
  }

  async findById(id: string): Promise<BookingRecord | null> {
    const row = await this.db.booking.findUnique({ where: { id }, include: BOOKING_INCLUDE })
    return row ? toRecord(row) : null
  }

  async listConfirmedOverlapping(barberId: string | null, from: Date, to: Date): Promise<BookingRecord[]> {
    const rows = await this.db.booking.findMany({
      where: {
        status: 'confirmed',
        startsAt: { lt: to },
        endsAt: { gt: from },
        ...(barberId ? { barberId } : {}),
      },
      include: BOOKING_INCLUDE,
      orderBy: { startsAt: 'asc' },
    })
    return rows.map(toRecord)
  }

  async setStatus(id: string, from: readonly BookingStatus[], to: BookingStatus): Promise<BookingRecord | null> {
    return this.db.$transaction(async tx => {
      const { count } = await tx.booking.updateMany({ where: { id, status: { in: [...from] } }, data: { status: to } })
      if (count === 0) return null
      const row = await tx.booking.findUniqueOrThrow({ where: { id }, include: BOOKING_INCLUDE })
      return toRecord(row)
    })
  }
}
