import { MAX_ACTIVE_BOOKINGS_PER_PHONE, UZ_PHONE_PATTERN } from '@barber/shared'
import { isWellFormedManageToken } from '../lib/tokens'
import { safeNotify } from '../notifications/notifier'
import type { BookingRecord } from '../repositories/types'
import type { BotDeps, TelegramActor } from './deps'

/**
 * Подтверждение записи с сайта через Telegram.
 *
 * 1. Клиент открывает t.me/<bot>?start=b_<manageToken> → startConfirmation.
 *    Номер этого Telegram уже подтверждён → запись подтверждается сразу.
 *    Иначе запись помечается «подтверждает этот Telegram» (claim) и бот просит «Поделиться номером».
 * 2. Клиент нажимает кнопку → acceptContact. Контакт должен быть его собственным (contact.user_id === from.id),
 *    номер — узбекский. Номер сохраняется как подтверждённый, все claimed-записи подтверждаются с этим номером
 *    (если на сайте ввели другой — в записи будет номер из Telegram).
 */

/** Номер из контакта Telegram → +998XXXXXXXXX. Другие страны и мусор → null. */
export function normalizeTelegramPhone(raw: string): string | null {
  const phone = `+${raw.replace(/\D/g, '')}`
  return UZ_PHONE_PATTERN.test(phone) ? phone : null
}

type ConfirmResult =
  | { readonly kind: 'confirmed'; readonly booking: BookingRecord }
  | { readonly kind: 'too_many' }
  | { readonly kind: 'expired' }

export type StartConfirmResult =
  | ConfirmResult
  | { readonly kind: 'not_pending' }
  | { readonly kind: 'not_found' }
  | { readonly kind: 'need_contact'; readonly booking: BookingRecord }

export async function startConfirmation(deps: BotDeps, token: string, actor: TelegramActor): Promise<StartConfirmResult> {
  const booking = isWellFormedManageToken(token) ? await deps.ctx.repos.bookings.findByToken(token) : null
  if (!booking) return { kind: 'not_found' }
  if (booking.status !== 'pending') return { kind: 'not_pending' }
  const now = new Date(deps.ctx.now())
  if (!booking.holdExpiresAt || booking.holdExpiresAt <= now) return { kind: 'expired' }
  const client = await deps.repo.findClientByTelegramId(actor.telegramId)
  if (client?.phoneVerifiedAt && client.phone) {
    await deps.repo.updateClientChat(client.id, actor.chatId)
    return confirm(deps, booking, { id: client.id, phone: client.phone }, now)
  }
  const claimed = await deps.repo.claimPending(booking.id, actor.telegramId, now)
  return claimed ? { kind: 'need_contact', booking } : { kind: 'expired' }
}

export type SharedContact = { readonly userId: number | undefined; readonly phoneNumber: string }

export type ContactResult =
  | { readonly kind: 'foreign' }
  | { readonly kind: 'not_uz' }
  | {
      readonly kind: 'verified'
      readonly confirmed: readonly BookingRecord[]
      readonly tooMany: number
      readonly expired: number
    }

export async function acceptContact(
  deps: BotDeps,
  actor: TelegramActor,
  contact: SharedContact,
  name: string,
): Promise<ContactResult> {
  // Переслать чужой контакт может кто угодно — номер подтверждает только собственный контакт отправителя.
  if (contact.userId === undefined || BigInt(contact.userId) !== actor.telegramId) return { kind: 'foreign' }
  const phone = normalizeTelegramPhone(contact.phoneNumber)
  if (!phone) return { kind: 'not_uz' }
  const now = new Date(deps.ctx.now())
  const clientId = await deps.repo.verifyPhone({ telegramId: actor.telegramId, chatId: actor.chatId, phone, name, now })
  const confirmed: BookingRecord[] = []
  let tooMany = 0
  let expired = 0
  for (const booking of await deps.repo.listClaimedPending(actor.telegramId, now)) {
    const result = await confirm(deps, booking, { id: clientId, phone }, now)
    if (result.kind === 'confirmed') confirmed.push(result.booking)
    else if (result.kind === 'too_many') tooMany += 1
    else expired += 1
  }
  return { kind: 'verified', confirmed, tooMany, expired }
}

async function confirm(
  deps: BotDeps,
  booking: BookingRecord,
  client: { readonly id: string; readonly phone: string },
  now: Date,
): Promise<ConfirmResult> {
  if ((await deps.ctx.repos.bookings.countUpcomingByPhone(client.phone, now)) >= MAX_ACTIVE_BOOKINGS_PER_PHONE) {
    return { kind: 'too_many' }
  }
  const confirmed = await deps.repo.confirmPending(booking.id, client.id, now)
  if (!confirmed) return { kind: 'expired' }
  // Теперь барбер узнаёт о записи, а клиент получает её детали в этот чат.
  await safeNotify(deps.log, 'bookingCreated', confirmed.id, () => deps.ctx.notifier.bookingCreated(confirmed))
  return { kind: 'confirmed', booking: confirmed }
}
