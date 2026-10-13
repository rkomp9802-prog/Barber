import type { BookingRecord } from '../repositories/types'

/**
 * Доступ к данным, который нужен только боту (привязка Telegram, коды барберов, комментарии к отзывам).
 * Общие операции (записи клиента, отмена, создание отзыва) бот берёт из Repositories,
 * чтобы правила оставались в одном месте. Реализации: prisma-repository.ts и in-memory подделка в тестах.
 */

/** Telegram-поля клиента. */
export type ClientTelegramInfo = {
  readonly id: string
  readonly telegramId: bigint | null
  readonly telegramChatId: bigint | null
}

/** Результат погашения одноразового кода барбера. */
export type ConsumedLinkCode = { readonly barberId: string; readonly barberName: string }

export interface TelegramRepository {
  findClientById(id: string): Promise<ClientTelegramInfo | null>
  findClientByTelegramId(telegramId: bigint): Promise<ClientTelegramInfo | null>
  /**
   * Записывает telegram_id и telegram_chat_id, только если у клиента ещё нет telegram_id.
   * false — telegram_id уже кто-то установил (гонка). Нарушение unique (этот Telegram уже у другого
   * клиента) пробрасывается как ошибка с кодом P2002/23505.
   */
  attachTelegram(clientId: string, telegramId: bigint, chatId: bigint): Promise<boolean>
  /** Обновляет чат для уведомлений (клиент написал боту из другого чата или впервые). */
  updateClientChat(clientId: string, chatId: bigint): Promise<void>
  /** Переносит запись к другому клиенту, только если она всё ещё принадлежит fromClientId. */
  moveBooking(bookingId: string, fromClientId: string, toClientId: string): Promise<boolean>
  findBookingById(id: string): Promise<BookingRecord | null>
  findBarberChatId(barberId: string): Promise<bigint | null>
  /**
   * Атомарно: код существует, не истёк и не использован → помечает used_at и записывает
   * barbers.telegram_chat_id. Иначе null.
   */
  consumeBarberLinkCode(code: string, now: Date, chatId: bigint): Promise<ConsumedLinkCode | null>
  /** Ставит комментарий к отзыву записи, только если комментария ещё нет. false — нечего обновлять. */
  setReviewComment(bookingId: string, comment: string): Promise<boolean>
}
