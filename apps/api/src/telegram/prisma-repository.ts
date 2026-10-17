import type { Db } from '../db/prisma'
import { BOOKING_INCLUDE, dropOrphanGuests, toRecord } from '../repositories/prisma/bookings'
import type { BookingRecord } from '../repositories/types'
import type { ClientTelegramInfo, ConsumedLinkCode, TelegramRepository, VerifiedPhoneInput } from './repository'

const CLIENT_TELEGRAM_SELECT = {
  id: true,
  telegramId: true,
  telegramChatId: true,
  phone: true,
  phoneVerifiedAt: true,
} as const

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

  async verifyPhone(input: VerifiedPhoneInput): Promise<string> {
    const row = await this.db.client.upsert({
      where: { telegramId: input.telegramId },
      create: {
        telegramId: input.telegramId,
        telegramChatId: input.chatId,
        name: input.name,
        phone: input.phone,
        phoneVerifiedAt: input.now,
      },
      update: { phone: input.phone, phoneVerifiedAt: input.now, telegramChatId: input.chatId },
      select: { id: true },
    })
    return row.id
  }

  async claimPending(bookingId: string, telegramId: bigint, now: Date): Promise<boolean> {
    const { count } = await this.db.booking.updateMany({
      where: { id: bookingId, status: 'pending', holdExpiresAt: { gt: now } },
      data: { claimTelegramId: telegramId },
    })
    return count > 0
  }

  async listClaimedPending(telegramId: bigint, now: Date): Promise<BookingRecord[]> {
    const rows = await this.db.booking.findMany({
      where: { claimTelegramId: telegramId, status: 'pending', holdExpiresAt: { gt: now } },
      include: BOOKING_INCLUDE,
      orderBy: { startsAt: 'asc' },
    })
    return rows.map(toRecord)
  }

  async swapMenuMessage(chatId: bigint, messageId: number): Promise<number | null> {
    return this.db.$transaction(async tx => {
      const previous = await tx.telegramScreen.findUnique({ where: { chatId }, select: { messageId: true } })
      await tx.telegramScreen.upsert({ where: { chatId }, create: { chatId, messageId }, update: { messageId } })
      return previous && previous.messageId !== messageId ? previous.messageId : null
    })
  }

  async confirmPending(bookingId: string, clientId: string, now: Date): Promise<BookingRecord | null> {
    return this.db.$transaction(async tx => {
      const current = await tx.booking.findUnique({
        where: { id: bookingId },
        select: { clientId: true, client: { select: { name: true } } },
      })
      if (!current) return null
      const { count } = await tx.booking.updateMany({
        where: { id: bookingId, status: 'pending', holdExpiresAt: { gt: now } },
        data: { status: 'confirmed', holdExpiresAt: null, claimTelegramId: null, holdIpHash: null, clientId },
      })
      if (count === 0) return null
      await tx.client.update({ where: { id: clientId }, data: { name: current.client.name } })
      // Запись перешла к Telegram-клиенту — гость с неподтверждённым номером больше не нужен.
      if (current.clientId !== clientId) await dropOrphanGuests(tx, [current.clientId])
      return toRecord(await tx.booking.findUniqueOrThrow({ where: { id: bookingId }, include: BOOKING_INCLUDE }))
    })
  }
}
