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
  readonly phone: string | null
  /** Номер подтверждён кнопкой «Поделиться номером» этим telegram_id. */
  readonly phoneVerifiedAt: Date | null
}

export type VerifiedPhoneInput = {
  readonly telegramId: bigint
  readonly chatId: bigint
  /** Уже проверенный и приведённый к +998XXXXXXXXX номер из контакта самого пользователя. */
  readonly phone: string
  /** Имя для нового клиента (если клиента с этим Telegram ещё нет). */
  readonly name: string
  readonly now: Date
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
  /** Клиент с этим Telegram (создаётся при необходимости) получает подтверждённый номер. Возвращает id клиента. */
  verifyPhone(input: VerifiedPhoneInput): Promise<string>
  /** Этот Telegram взялся подтвердить pending-запись. false — запись уже не pending или срок истёк. */
  claimPending(bookingId: string, telegramId: bigint, now: Date): Promise<boolean>
  /** Живые pending, которые этот Telegram взялся подтвердить. */
  listClaimedPending(telegramId: bigint, now: Date): Promise<BookingRecord[]>
  /**
   * Атомарно: запись pending и срок не истёк → confirmed; запись переходит к клиенту clientId,
   * его имя — то, что ввели при записи. null — подтвердить уже нельзя.
   */
  confirmPending(bookingId: string, clientId: string, now: Date): Promise<BookingRecord | null>
  /** Запоминает сообщение-меню чата и возвращает прежнее (его можно удалить). null — прежнего нет или это оно же. */
  swapMenuMessage(chatId: bigint, messageId: number): Promise<number | null>
}
