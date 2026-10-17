import type { PublicReviewDto } from '@barber/shared'
import type { Db } from '../../db/prisma'
import type {
  ClientRecord,
  ClientRepository,
  NewReview,
  ReviewRepository,
  SettingsRepository,
  TelegramClientInput,
} from '../types'

export class PrismaSettingsRepository implements SettingsRepository {
  constructor(private readonly db: Db) {}

  async getAll(): Promise<Record<string, unknown>> {
    const rows = await this.db.setting.findMany()
    return Object.fromEntries(rows.map(row => [row.key, row.value]))
  }
}

export class PrismaClientRepository implements ClientRepository {
  constructor(private readonly db: Db) {}

  /** upsert по уникальному telegram_id: безопасно при параллельных первых запросах. */
  async findOrCreateByTelegram(input: TelegramClientInput): Promise<ClientRecord> {
    const row = await this.db.client.upsert({
      where: { telegramId: input.telegramId },
      create: { telegramId: input.telegramId, name: input.name },
      update: {},
    })
    return { id: row.id, name: row.name, phone: row.phone, telegramId: row.telegramId, phoneVerifiedAt: row.phoneVerifiedAt }
  }
}

/** Имя клиента для публичного отзыва: только первое слово, без фамилии. */
function publicFirstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? 'Клиент'
}

export class PrismaReviewRepository implements ReviewRepository {
  constructor(private readonly db: Db) {}

  async listPublic(minRating: number, limit: number): Promise<PublicReviewDto[]> {
    const rows = await this.db.review.findMany({
      where: { isPublic: true, rating: { gte: minRating }, barber: { isActive: true } },
      include: { client: { select: { name: true } }, barber: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
    return rows.map(row => ({
      id: row.id,
      clientName: publicFirstName(row.client.name),
      barberId: row.barberId,
      barberName: row.barber.name,
      rating: row.rating,
      comment: row.comment ?? '',
      createdAt: row.createdAt.toISOString(),
    }))
  }

  async existsForBooking(bookingId: string): Promise<boolean> {
    const row = await this.db.review.findUnique({ where: { bookingId }, select: { id: true } })
    return row !== null
  }

  async create(input: NewReview): Promise<{ id: string }> {
    return this.db.review.create({ data: { ...input }, select: { id: true } })
  }
}
