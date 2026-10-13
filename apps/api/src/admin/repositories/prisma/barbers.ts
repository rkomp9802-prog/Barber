import type { WeeklyRangeDto } from '@barber/shared'
import type { Db } from '../../../db/prisma'
import type { Prisma } from '../../../generated/prisma/client'
import type {
  AdminBarberData,
  AdminBarberLinkRecord,
  AdminBarberRecord,
  AdminBarberRepository,
  BarberServiceSetting,
  PortfolioItemRecord,
  WeeklySchedule,
} from '../types'

export const ADMIN_BARBER_INCLUDE = {
  services: {
    include: { service: { select: { name: true, durationMin: true, price: true } } },
    orderBy: { service: { sortOrder: 'asc' } },
  },
  portfolio: { orderBy: { sortOrder: 'asc' } },
  workingHours: { orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }] },
  breaks: { orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }] },
} as const satisfies Prisma.BarberInclude

type BarberRow = Prisma.BarberGetPayload<{ include: typeof ADMIN_BARBER_INCLUDE }>
type RangeRow = { weekday: number; startTime: string; endTime: string }

const BARBER_ORDER = [{ sortOrder: 'asc' as const }, { name: 'asc' as const }]

function toRange(row: RangeRow): WeeklyRangeDto {
  return { weekday: row.weekday, startTime: row.startTime, endTime: row.endTime }
}

function toLink(row: BarberRow['services'][number]): AdminBarberLinkRecord {
  return {
    serviceId: row.serviceId,
    serviceName: row.service.name,
    serviceDurationMin: row.service.durationMin,
    servicePrice: row.service.price,
    isEnabled: row.isEnabled,
    durationMin: row.durationMin,
    price: row.price,
  }
}

function toPortfolio(row: { id: string; imageUrl: string; sortOrder: number }): PortfolioItemRecord {
  return { id: row.id, imageUrl: row.imageUrl, sortOrder: row.sortOrder }
}

export function toBarberRecord(row: BarberRow): AdminBarberRecord {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    bio: row.bio,
    photoUrl: row.photoUrl,
    experienceYears: row.experienceYears,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
    telegramLinked: row.telegramChatId !== null,
    services: row.services.map(toLink),
    portfolio: row.portfolio.map(toPortfolio),
    workingHours: row.workingHours.map(toRange),
    breaks: row.breaks.map(toRange),
  }
}

/** Барберы, их услуги, портфолио и график. */
export class PrismaAdminBarberRepository implements AdminBarberRepository {
  constructor(private readonly db: Db) {}

  async list(): Promise<AdminBarberRecord[]> {
    const rows = await this.db.barber.findMany({ include: ADMIN_BARBER_INCLUDE, orderBy: BARBER_ORDER })
    return rows.map(toBarberRecord)
  }

  async findById(id: string): Promise<AdminBarberRecord | null> {
    const row = await this.db.barber.findUnique({ where: { id }, include: ADMIN_BARBER_INCLUDE })
    return row ? toBarberRecord(row) : null
  }

  async create(data: AdminBarberData): Promise<AdminBarberRecord> {
    const row = await this.db.barber.create({ data: { ...data }, include: ADMIN_BARBER_INCLUDE })
    return toBarberRecord(row)
  }

  async update(id: string, patch: Partial<AdminBarberData>): Promise<AdminBarberRecord | null> {
    const existing = await this.db.barber.findUnique({ where: { id }, select: { id: true } })
    if (!existing) return null
    const row = await this.db.barber.update({ where: { id }, data: { ...patch }, include: ADMIN_BARBER_INCLUDE })
    return toBarberRecord(row)
  }

  async replaceServices(id: string, services: readonly BarberServiceSetting[]): Promise<void> {
    await this.db.$transaction(async tx => {
      await tx.barberService.deleteMany({ where: { barberId: id } })
      if (services.length === 0) return
      await tx.barberService.createMany({
        data: services.map(service => ({
          barberId: id,
          serviceId: service.serviceId,
          isEnabled: service.isEnabled,
          durationMin: service.durationMin,
          price: service.price,
        })),
      })
    })
  }

  async replaceSchedule(id: string, schedule: WeeklySchedule): Promise<void> {
    await this.db.$transaction(async tx => {
      await tx.workingHour.deleteMany({ where: { barberId: id } })
      await tx.break.deleteMany({ where: { barberId: id } })
      if (schedule.workingHours.length > 0) {
        await tx.workingHour.createMany({ data: schedule.workingHours.map(range => ({ barberId: id, ...range })) })
      }
      if (schedule.breaks.length > 0) {
        await tx.break.createMany({ data: schedule.breaks.map(range => ({ barberId: id, ...range })) })
      }
    })
  }

  async addPortfolioItem(barberId: string, imageUrl: string): Promise<PortfolioItemRecord> {
    const count = await this.db.portfolioItem.count({ where: { barberId } })
    const row = await this.db.portfolioItem.create({ data: { barberId, imageUrl, sortOrder: count } })
    return toPortfolio(row)
  }

  async deletePortfolioItem(itemId: string): Promise<boolean> {
    const { count } = await this.db.portfolioItem.deleteMany({ where: { id: itemId } })
    return count > 0
  }

  async reorderPortfolio(barberId: string, itemIds: readonly string[]): Promise<PortfolioItemRecord[]> {
    const rows = await this.db.$transaction(async tx => {
      for (const [index, itemId] of itemIds.entries()) {
        await tx.portfolioItem.updateMany({ where: { id: itemId, barberId }, data: { sortOrder: index } })
      }
      return tx.portfolioItem.findMany({ where: { barberId }, orderBy: { sortOrder: 'asc' } })
    })
    return rows.map(toPortfolio)
  }
}
