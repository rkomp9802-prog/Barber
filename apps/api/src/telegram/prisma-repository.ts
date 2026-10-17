import type { Db } from '../db/prisma'
import { BOOKING_INCLUDE, toRecord } from '../repositories/prisma/bookings'
import type { BookingRecord } from '../repositories/types'
import type { ClientTelegramInfo, ConsumedLinkCode, TelegramRepository } from './repository'

const CLIENT_TELEGRAM_SELECT = { id: true, telegramId: true, telegramChatId: true } as const

/** Реализация TelegramRepository на Prisma (таблицы clients, bookings, barbers, barber_link_codes, reviews). */
export class PrismaTelegramRepository implements TelegramRepository {
  constructor(private readonly db: Db) {}

  async findClientById(id: string): Promise<ClientTelegramInfo | null> {
    return this.db.client.findUnique({ where: { id }, select: CLIENT_TELEGRAM_SELECT })
  }

  async findClientByTelegramId(telegramId: bigint): Promise<ClientTelegramInfo | null> {
    return this.db.client.findUnique({ where: { telegramId }, select: CLIENT_TELEGRAM_SELECT })
  }

  async attachTelegram(clientId: string, telegramId: bigint, chatId: bigint): Promise<boolean> {
    const { count } = await this.db.client.updateMany({
      where: { id: clientId, telegramId: null },
      data: { telegramId, telegramChatId: chatId },
    })
    return count > 0
  }

  async updateClientChat(clientId: string, chatId: bigint): Promise<void> {
    await this.db.client.update({ where: { id: clientId }, data: { telegramChatId: chatId } })
  }

  async moveBooking(bookingId: string, fromClientId: string, toClientId: string): Promise<boolean> {
    const { count } = await this.db.booking.updateMany({
      where: { id: bookingId, clientId: fromClientId },
      data: { clientId: toClientId },
    })
    return count > 0
  }

  async findBookingById(id: string): Promise<BookingRecord | null> {
    const row = await this.db.booking.findUnique({ where: { id }, include: BOOKING_INCLUDE })
    return row ? toRecord(row) : null
  }

  async findBarberChatId(barberId: string): Promise<bigint | null> {
    const row = await this.db.barber.findUnique({ where: { id: barberId }, select: { telegramChatId: true } })
    return row?.telegramChatId ?? null
  }

  /** Условный UPDATE в транзакции: один и тот же код нельзя погасить дважды даже параллельно. */
  async consumeBarberLinkCode(code: string, now: Date, chatId: bigint): Promise<ConsumedLinkCode | null> {
    return this.db.$transaction(async tx => {
      const { count } = await tx.barberLinkCode.updateMany({
        where: { code, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      })
      if (count === 0) return null
      const link = await tx.barberLinkCode.findUniqueOrThrow({ where: { code }, select: { barberId: true } })
      const barber = await tx.barber.update({
        where: { id: link.barberId },
        data: { telegramChatId: chatId },
        select: { id: true, name: true },
      })
      return { barberId: barber.id, barberName: barber.name }
    })
  }

  async setReviewComment(bookingId: string, comment: string): Promise<boolean> {
    // Отзыв с текстом скрываем до модерации в админке (как и отзывы с сайта).
    const { count } = await this.db.review.updateMany({
      where: { bookingId, comment: null },
      data: { comment, isPublic: false },
    })
    return count > 0
  }
}
