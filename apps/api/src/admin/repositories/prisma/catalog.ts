import type { Db } from '../../../db/prisma'
import type { AdminServiceData, AdminServiceRecord, AdminServiceRepository } from '../types'

const SERVICE_ORDER = [{ sortOrder: 'asc' as const }, { name: 'asc' as const }]

type ServiceRow = AdminServiceData & { id: string }

function toRecord(row: ServiceRow): AdminServiceRecord {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    durationMin: row.durationMin,
    price: row.price,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
  }
}

/** Услуги каталога, включая скрытые (is_active=false). */
export class PrismaAdminServiceRepository implements AdminServiceRepository {
  constructor(private readonly db: Db) {}

  async list(): Promise<AdminServiceRecord[]> {
    const rows = await this.db.service.findMany({ orderBy: SERVICE_ORDER })
    return rows.map(toRecord)
  }

  async findById(id: string): Promise<AdminServiceRecord | null> {
    const row = await this.db.service.findUnique({ where: { id } })
    return row ? toRecord(row) : null
  }

  async create(data: AdminServiceData): Promise<AdminServiceRecord> {
    const row = await this.db.service.create({ data })
    return toRecord(row)
  }

  async update(id: string, patch: Partial<AdminServiceData>): Promise<AdminServiceRecord | null> {
    const existing = await this.db.service.findUnique({ where: { id }, select: { id: true } })
    if (!existing) return null
    const row = await this.db.service.update({ where: { id }, data: patch })
    return toRecord(row)
  }
}
