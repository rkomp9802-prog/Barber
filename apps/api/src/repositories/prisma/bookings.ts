import { BOOKING_SOURCES, BOOKING_STATUSES, type BookingSource, type BookingStatus } from '@barber/shared'
import type { Db } from '../../db/prisma'
import type { Prisma } from '../../generated/prisma/client'
import type { BookingClientRef, BookingRecord, BookingRepository, NewBooking } from '../types'

export const BOOKING_INCLUDE = {
  barber: { select: { name: true } },
  client: { select: { name: true, phone: true } },
  services: true,
} as const satisfies Prisma.BookingInclude

type BookingRow = Prisma.BookingGetPayload<{ include: typeof BOOKING_INCLUDE }>
type Tx = Prisma.TransactionClient

function asStatus(value: string): BookingStatus {
  const found = BOOKING_STATUSES.find(status => status === value)
  if (!found) throw new Error(`Неизвестный статус записи: ${value}`)
  return found
}

function asSource(value: string): BookingSource {
  const found = BOOKING_SOURCES.find(source => source === value)
  if (!found) throw new Error(`Неизвестный источник записи: ${value}`)
  return found
}

export function toRecord(row: BookingRow): BookingRecord {
  return {
    id: row.id,
    clientId: row.clientId,
    barberId: row.barberId,
    barberName: row.barber.name,
    client: { name: row.client.name, phone: row.client.phone },
    status: asStatus(row.status),
    source: asSource(row.source),
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    totalPrice: row.totalPrice,
    totalDurationMin: row.totalDurationMin,
    manageToken: row.manageToken,
    services: row.services.map(s => ({ serviceId: s.serviceId, name: s.name, durationMin: s.durationMin, price: s.price })),
    createdAt: row.createdAt,
  }
}

/** Гость с сайта: переиспользуем клиента с тем же телефоном (без Telegram), иначе создаём. */
async function resolveClientId(tx: Tx, ref: BookingClientRef): Promise<string> {
  if (ref.kind === 'existing') {
    await tx.client.update({ where: { id: ref.clientId }, data: { name: ref.name, phone: ref.phone } })
    return ref.clientId
  }
  const existing = await tx.client.findFirst({
    where: { phone: ref.phone, telegramId: null },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })
  if (existing) return existing.id
  const created = await tx.client.create({ data: { name: ref.name, phone: ref.phone }, select: { id: true } })
  return created.id
}

export class PrismaBookingRepository implements BookingRepository {
  constructor(private readonly db: Db) {}

  async create(input: NewBooking): Promise<BookingRecord> {
    const row = await this.db.$transaction(async tx => {
      const clientId = await resolveClientId(tx, input.client)
      return tx.booking.create({
        data: {
          clientId,
          barberId: input.barberId,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          totalPrice: input.totalPrice,
          totalDurationMin: input.totalDurationMin,
          status: 'confirmed',
          source: input.source,
          manageToken: input.manageToken,
          services: { create: input.services.map(s => ({ ...s })) },
        },
        include: BOOKING_INCLUDE,
      })
    })
    return toRecord(row)
  }

  async findByToken(token: string): Promise<BookingRecord | null> {
    const row = await this.db.booking.findUnique({ where: { manageToken: token }, include: BOOKING_INCLUDE })
    return row ? toRecord(row) : null
  }

  async listByClient(clientId: string, limit: number): Promise<BookingRecord[]> {
    const rows = await this.db.booking.findMany({
      where: { clientId },
      include: BOOKING_INCLUDE,
      orderBy: { startsAt: 'desc' },
      take: limit,
    })
    return rows.map(toRecord)
  }

  async cancel(id: string): Promise<BookingRecord | null> {
    return this.updateIfConfirmed(id, { status: 'cancelled' })
  }

  async reschedule(id: string, startsAt: Date, endsAt: Date): Promise<BookingRecord | null> {
    return this.updateIfConfirmed(id, {
      startsAt,
      endsAt,
      // Напоминания должны прийти заново — уже к новому времени.
      reminderDaySentAt: null,
      reminder30mSentAt: null,
    })
  }

  /** Условное обновление в транзакции: параллельная отмена/перенос не перетрут друг друга. */
  private async updateIfConfirmed(id: string, data: Prisma.BookingUpdateManyMutationInput): Promise<BookingRecord | null> {
    return this.db.$transaction(async tx => {
      const { count } = await tx.booking.updateMany({ where: { id, status: 'confirmed' }, data })
      if (count === 0) return null
      const row = await tx.booking.findUniqueOrThrow({ where: { id }, include: BOOKING_INCLUDE })
      return toRecord(row)
    })
  }
}
