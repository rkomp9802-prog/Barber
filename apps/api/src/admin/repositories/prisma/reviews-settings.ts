import type { Db } from '../../../db/prisma'
import type { Prisma } from '../../../generated/prisma/client'
import type { AdminReviewRecord, AdminReviewRepository, AdminSettingsRepository, ReviewFilter } from '../types'

const REVIEW_INCLUDE = {
  booking: { select: { startsAt: true } },
  barber: { select: { name: true } },
  client: { select: { name: true, phone: true } },
} as const satisfies Prisma.ReviewInclude

type ReviewRow = Prisma.ReviewGetPayload<{ include: typeof REVIEW_INCLUDE }>

function toRecord(row: ReviewRow): AdminReviewRecord {
  return {
    id: row.id,
    bookingId: row.bookingId,
    bookingStartsAt: row.booking.startsAt,
    barberId: row.barberId,
    barberName: row.barber.name,
    clientName: row.client.name,
    clientPhone: row.client.phone,
    rating: row.rating,
    comment: row.comment,
    isPublic: row.isPublic,
    createdAt: row.createdAt,
  }
}

function whereOf(filter: ReviewFilter): Prisma.ReviewWhereInput {
  const rating: Prisma.IntFilter = {
    ...(filter.minRating === undefined ? {} : { gte: filter.minRating }),
    ...(filter.maxRating === undefined ? {} : { lte: filter.maxRating }),
  }
  return {
    ...(filter.barberId ? { barberId: filter.barberId } : {}),
    ...(filter.isPublic === undefined ? {} : { isPublic: filter.isPublic }),
    ...(Object.keys(rating).length > 0 ? { rating } : {}),
  }
}

/** Отзывы для админки (все, включая скрытые). */
export class PrismaAdminReviewRepository implements AdminReviewRepository {
  constructor(private readonly db: Db) {}

  async list(filter: ReviewFilter): Promise<{ items: AdminReviewRecord[]; total: number }> {
    const where = whereOf(filter)
    const [rows, total] = await this.db.$transaction([
      this.db.review.findMany({
        where,
        include: REVIEW_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: filter.offset,
        take: filter.limit,
      }),
      this.db.review.count({ where }),
    ])
    return { items: rows.map(toRecord), total }
  }

  async setPublic(id: string, isPublic: boolean): Promise<AdminReviewRecord | null> {
    const existing = await this.db.review.findUnique({ where: { id }, select: { id: true } })
    if (!existing) return null
    const row = await this.db.review.update({ where: { id }, data: { isPublic }, include: REVIEW_INCLUDE })
    return toRecord(row)
  }
}

/** Таблица settings: key → jsonb. */
export class PrismaAdminSettingsRepository implements AdminSettingsRepository {
  constructor(private readonly db: Db) {}

  async getAll(): Promise<Record<string, unknown>> {
    const rows = await this.db.setting.findMany()
    return Object.fromEntries(rows.map(row => [row.key, row.value]))
  }

  async upsertMany(values: Readonly<Record<string, string | number>>): Promise<void> {
    const operations = Object.entries(values).map(([key, value]) =>
      this.db.setting.upsert({ where: { key }, create: { key, value }, update: { value } }),
    )
    await this.db.$transaction(operations)
  }
}
