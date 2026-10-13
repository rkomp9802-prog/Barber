import type { Db } from '../../../db/prisma'
import type { Prisma } from '../../../generated/prisma/client'
import type { AdminTimeOffData, AdminTimeOffRecord, AdminTimeOffRepository, TimeOffFilter } from '../types'

const TIME_OFF_INCLUDE = { barber: { select: { name: true } } } as const satisfies Prisma.TimeOffInclude

type TimeOffRow = Prisma.TimeOffGetPayload<{ include: typeof TIME_OFF_INCLUDE }>

function toRecord(row: TimeOffRow): AdminTimeOffRecord {
  return {
    id: row.id,
    barberId: row.barberId,
    barberName: row.barber?.name ?? null,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    type: row.type as AdminTimeOffRecord['type'],
    note: row.note,
  }
}

function whereOf(filter: TimeOffFilter): Prisma.TimeOffWhereInput {
  return {
    ...(filter.barberId === undefined ? {} : { barberId: filter.barberId }),
    ...(filter.from ? { endsAt: { gt: filter.from } } : {}),
    ...(filter.to ? { startsAt: { lt: filter.to } } : {}),
  }
}

/** Исключения: выходные, отпуска, закрытие всего барбершопа (barber_id = null). */
export class PrismaAdminTimeOffRepository implements AdminTimeOffRepository {
  constructor(private readonly db: Db) {}

  async list(filter: TimeOffFilter): Promise<AdminTimeOffRecord[]> {
    const rows = await this.db.timeOff.findMany({
      where: whereOf(filter),
      include: TIME_OFF_INCLUDE,
      orderBy: { startsAt: 'asc' },
    })
    return rows.map(toRecord)
  }

  async findById(id: string): Promise<AdminTimeOffRecord | null> {
    const row = await this.db.timeOff.findUnique({ where: { id }, include: TIME_OFF_INCLUDE })
    return row ? toRecord(row) : null
  }

  async create(data: AdminTimeOffData): Promise<AdminTimeOffRecord> {
    const row = await this.db.timeOff.create({ data: { ...data }, include: TIME_OFF_INCLUDE })
    return toRecord(row)
  }

  async update(id: string, data: AdminTimeOffData): Promise<AdminTimeOffRecord | null> {
    const existing = await this.db.timeOff.findUnique({ where: { id }, select: { id: true } })
    if (!existing) return null
    const row = await this.db.timeOff.update({ where: { id }, data: { ...data }, include: TIME_OFF_INCLUDE })
    return toRecord(row)
  }

  async delete(id: string): Promise<boolean> {
    const { count } = await this.db.timeOff.deleteMany({ where: { id } })
    return count > 0
  }
}
