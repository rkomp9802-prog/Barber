import type { Db } from '../../db/prisma'
import type { BarberServiceLink } from '../../domain/pricing'
import type { BarberProfile, BarberRecord, CatalogRepository, ServiceRecord } from '../types'

const ORDER = [{ sortOrder: 'asc' as const }, { name: 'asc' as const }]

type ServiceRow = {
  id: string
  name: string
  description: string
  durationMin: number
  price: number
  isActive: boolean
  sortOrder: number
}

function toService(row: ServiceRow): ServiceRecord {
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

type BarberRow = Omit<BarberRecord, never> & { telegramChatId?: bigint | null }

function toBarber(row: BarberRow): BarberRecord {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    bio: row.bio,
    photoUrl: row.photoUrl,
    experienceYears: row.experienceYears,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
  }
}

const RATING_PRECISION = 10

export class PrismaCatalogRepository implements CatalogRepository {
  constructor(private readonly db: Db) {}

  async listActiveServices(): Promise<ServiceRecord[]> {
    const rows = await this.db.service.findMany({ where: { isActive: true }, orderBy: ORDER })
    return rows.map(toService)
  }

  async findServicesByIds(ids: readonly string[]): Promise<ServiceRecord[]> {
    const rows = await this.db.service.findMany({ where: { id: { in: [...ids] } } })
    return rows.map(toService)
  }

  async listActiveBarbers(ids?: readonly string[]): Promise<BarberRecord[]> {
    const rows = await this.db.barber.findMany({
      where: { isActive: true, ...(ids ? { id: { in: [...ids] } } : {}) },
      orderBy: ORDER,
    })
    return rows.map(toBarber)
  }

  async listActiveBarberProfiles(): Promise<BarberProfile[]> {
    const barbers = await this.listActiveBarbers()
    return this.withProfiles(barbers)
  }

  async findBarberProfile(id: string): Promise<BarberProfile | null> {
    const row = await this.db.barber.findFirst({ where: { id, isActive: true } })
    if (!row) return null
    const [profile] = await this.withProfiles([toBarber(row)])
    return profile ?? null
  }

  async listBarberServiceLinks(serviceIds: readonly string[]): Promise<BarberServiceLink[]> {
    const rows = await this.db.barberService.findMany({ where: { serviceId: { in: [...serviceIds] } } })
    return rows.map(row => ({
      barberId: row.barberId,
      serviceId: row.serviceId,
      durationMin: row.durationMin,
      price: row.price,
      isEnabled: row.isEnabled,
    }))
  }

  /** Догружает услуги, портфолио и рейтинг (по всем отзывам) одним набором запросов. */
  private async withProfiles(barbers: readonly BarberRecord[]): Promise<BarberProfile[]> {
    const ids = barbers.map(barber => barber.id)
    const [links, portfolio, ratings] = await Promise.all([
      this.db.barberService.findMany({
        where: { barberId: { in: ids }, isEnabled: true, service: { isActive: true } },
        orderBy: { service: { sortOrder: 'asc' } },
      }),
      this.db.portfolioItem.findMany({ where: { barberId: { in: ids } }, orderBy: { sortOrder: 'asc' } }),
      this.db.review.groupBy({ by: ['barberId'], where: { barberId: { in: ids } }, _avg: { rating: true }, _count: true }),
    ])
    return barbers.map(barber => {
      const stats = ratings.find(r => r.barberId === barber.id)
      const average = stats?._avg.rating ?? 0
      return {
        ...barber,
        serviceIds: links.filter(l => l.barberId === barber.id).map(l => l.serviceId),
        portfolio: portfolio.filter(p => p.barberId === barber.id).map(p => p.imageUrl),
        rating: Math.round(average * RATING_PRECISION) / RATING_PRECISION,
        reviewsCount: stats?._count ?? 0,
      }
    })
  }
}
