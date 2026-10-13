import { isUniqueViolation } from '../errors'
import { isWellFormedManageToken } from '../lib/tokens'
import type { BookingRecord, BookingRepository } from '../repositories/types'
import type { TelegramActor } from './deps'
import type { TelegramRepository } from './repository'

export const BOOKING_START_PREFIX = 'b_'

export type LinkBookingResult =
  | { readonly kind: 'linked'; readonly booking: BookingRecord }
  | { readonly kind: 'not_found' }
  | { readonly kind: 'conflict' }

type LinkDeps = { readonly repo: TelegramRepository; readonly bookings: BookingRepository }

/**
 * Deep link t.me/<bot>?start=b_<manageToken>: привязывает запись с сайта к Telegram-пользователю.
 *
 * - клиент записи уже привязан к этому пользователю → только обновляем чат;
 * - клиент привязан к другому Telegram → конфликт, ничего не меняем;
 * - у пользователя уже есть свой клиент (например, из Mini App) → переносим эту запись к нему,
 *   потому что telegram_id уникален и двум клиентам его не выдать;
 * - иначе записываем telegram_id / telegram_chat_id клиенту записи.
 */
export async function linkBookingToTelegram(
  deps: LinkDeps,
  token: string,
  actor: TelegramActor,
): Promise<LinkBookingResult> {
  const booking = isWellFormedManageToken(token) ? await deps.bookings.findByToken(token) : null
  const client = booking ? await deps.repo.findClientById(booking.clientId) : null
  if (!booking || !client) return { kind: 'not_found' }
  if (client.telegramId === actor.telegramId) {
    await deps.repo.updateClientChat(client.id, actor.chatId)
    return { kind: 'linked', booking }
  }
  if (client.telegramId !== null) return { kind: 'conflict' }
  const own = await deps.repo.findClientByTelegramId(actor.telegramId)
  if (own) {
    const moved = await deps.repo.moveBooking(booking.id, client.id, own.id)
    if (!moved) return { kind: 'conflict' }
    await deps.repo.updateClientChat(own.id, actor.chatId)
    return { kind: 'linked', booking: { ...booking, clientId: own.id } }
  }
  return attachClient(deps.repo, booking, actor)
}

async function attachClient(
  repo: TelegramRepository,
  booking: BookingRecord,
  actor: TelegramActor,
): Promise<LinkBookingResult> {
  try {
    const attached = await repo.attachTelegram(booking.clientId, actor.telegramId, actor.chatId)
    return attached ? { kind: 'linked', booking } : { kind: 'conflict' }
  } catch (error: unknown) {
    // Параллельно этот же Telegram успел стать другим клиентом — сообщаем о конфликте, а не о сбое.
    if (isUniqueViolation(error)) return { kind: 'conflict' }
    throw error
  }
}
