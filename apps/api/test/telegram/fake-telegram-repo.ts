import { randomUUID } from 'node:crypto'
import type { BookingRecord } from '../../src/repositories/types'
import type { ClientTelegramInfo, ConsumedLinkCode, TelegramRepository } from '../../src/telegram/repository'
import type { MemoryState } from '../fakes/memory-repositories'

/** Telegram-поля, которых нет в MemoryState: чаты, коды барберов. */
export type TelegramExtras = {
  /** clientId → telegram_chat_id клиента. */
  readonly clientChats: Map<string, bigint>
  /** barberId → barbers.telegram_chat_id. */
  readonly barberChats: Map<string, bigint>
  /** Одноразовые коды барберов (barber_link_codes). */
  readonly linkCodes: Map<string, { barberId: string; expiresAt: Date; usedAt: Date | null }>
  /** chat_id → id последнего сообщения-меню (telegram_screens). */
  readonly menuMessages: Map<bigint, number>
}

export function createTelegramExtras(): TelegramExtras {
  return { clientChats: new Map(), barberChats: new Map(), linkCodes: new Map(), menuMessages: new Map() }
}

type StoredBooking = MemoryState['bookings'][number]

/** Запись в виде, которую отдаёт репозиторий (без полей напоминаний). */
export function toPublicBooking(booking: StoredBooking): BookingRecord {
  const { reminderDaySentAt: _day, reminder30mSentAt: _short, holdIpHash: _ip, claimTelegramId: _claim, ...record } = booking
  return { ...record, client: { ...record.client }, services: record.services.map(s => ({ ...s })) }
}

function uniqueViolation(): Error {
  return Object.assign(new Error('Unique constraint failed on the fields: (`telegram_id`)'), { code: 'P2002' })
}

/** In-memory TelegramRepository поверх того же состояния, что и основные репозитории. */
export function createFakeTelegramRepo(state: MemoryState, extras: TelegramExtras): TelegramRepository {
  const findClient = (id: string): MemoryState['clients'][number] | undefined => state.clients.find(c => c.id === id)
  const toInfo = (client: MemoryState['clients'][number]): ClientTelegramInfo => ({
    id: client.id,
    telegramId: client.telegramId,
    telegramChatId: extras.clientChats.get(client.id) ?? null,
    phone: client.phone,
    phoneVerifiedAt: client.phoneVerifiedAt ?? null,
  })
  const isLivePending = (booking: StoredBooking, now: Date): boolean =>
    booking.status === 'pending' && booking.holdExpiresAt !== null && booking.holdExpiresAt > now
  return {
    findClientById: async id => {
      const client = findClient(id)
      return client ? toInfo(client) : null
    },
    findClientByTelegramId: async telegramId => {
      const client = state.clients.find(c => c.telegramId === telegramId)
      return client ? toInfo(client) : null
    },
    attachTelegram: async (clientId, telegramId, chatId) => {
      const client = findClient(clientId)
      if (!client || client.telegramId !== null) return false
      if (state.clients.some(c => c.telegramId === telegramId)) throw uniqueViolation()
      state.clients = state.clients.map(c => (c.id === clientId ? { ...c, telegramId } : c))
      extras.clientChats.set(clientId, chatId)
      return true
    },
    updateClientChat: async (clientId, chatId) => {
      extras.clientChats.set(clientId, chatId)
    },
    moveBooking: async (bookingId, fromClientId, toClientId) => {
      const booking = state.bookings.find(b => b.id === bookingId && b.clientId === fromClientId)
      if (!booking) return false
      state.bookings = state.bookings.map(b => (b.id === bookingId ? { ...b, clientId: toClientId } : b))
      return true
    },
    findBookingById: async id => {
      const booking = state.bookings.find(b => b.id === id)
      return booking ? toPublicBooking(booking) : null
    },
    findBarberChatId: async barberId => extras.barberChats.get(barberId) ?? null,
    consumeBarberLinkCode: async (code, now, chatId): Promise<ConsumedLinkCode | null> => {
      const entry = extras.linkCodes.get(code)
      if (!entry || entry.usedAt !== null || entry.expiresAt.getTime() <= now.getTime()) return null
      extras.linkCodes.set(code, { ...entry, usedAt: now })
      extras.barberChats.set(entry.barberId, chatId)
      const barber = state.barbers.find(b => b.id === entry.barberId)
      return { barberId: entry.barberId, barberName: barber?.name ?? '' }
    },
    setReviewComment: async (bookingId, comment) => {
      const target = state.reviews.find(r => r.bookingId === bookingId && r.comment === null)
      if (!target) return false
      state.reviews = state.reviews.map(r => (r === target ? { ...r, comment, isPublic: false } : r))
      return true
    },
    verifyPhone: async input => {
      const existing = state.clients.find(c => c.telegramId === input.telegramId)
      const id = existing?.id ?? randomUUID()
      const verified = { phone: input.phone, phoneVerifiedAt: input.now }
      state.clients = existing
        ? state.clients.map(c => (c.id === id ? { ...c, ...verified } : c))
        : [...state.clients, { id, name: input.name, telegramId: input.telegramId, ...verified }]
      extras.clientChats.set(id, input.chatId)
      return id
    },
    claimPending: async (bookingId, telegramId, now) => {
      const booking = state.bookings.find(b => b.id === bookingId)
      if (!booking || !isLivePending(booking, now)) return false
      state.bookings = state.bookings.map(b => (b.id === bookingId ? { ...b, claimTelegramId: telegramId } : b))
      return true
    },
    listClaimedPending: async (telegramId, now) =>
      state.bookings.filter(b => b.claimTelegramId === telegramId && isLivePending(b, now)).map(toPublicBooking),
    confirmPending: async (bookingId, clientId, now) => {
      const booking = state.bookings.find(b => b.id === bookingId)
      const client = findClient(clientId)
      if (!booking || !client || !isLivePending(booking, now)) return null
      const name = booking.client.name
      state.clients = state.clients.map(c => (c.id === clientId ? { ...c, name } : c))
      const next: StoredBooking = {
        ...booking,
        status: 'confirmed',
        holdExpiresAt: null,
        claimTelegramId: null,
        holdIpHash: null,
        clientId,
        client: { name, phone: client.phone },
      }
      state.bookings = state.bookings.map(b => (b.id === bookingId ? next : b))
      return toPublicBooking(next)
    },
    swapMenuMessage: async (chatId, messageId) => {
      const previous = extras.menuMessages.get(chatId)
      extras.menuMessages.set(chatId, messageId)
      return previous !== undefined && previous !== messageId ? previous : null
    },
  }
}
