/**
 * Минимальный клиент Telegram Bot API: только sendMessage через fetch.
 * Используется из jobs.ts. Не зависит от Deno-API, поэтому тоже тестируется в Node.
 */
import { classifyTelegramFailure, type FailureAction, type InlineKeyboardMarkup } from './logic.ts'

const TELEGRAM_API = 'https://api.telegram.org'
const REQUEST_TIMEOUT_MS = 10_000

export interface OutgoingMessage {
  readonly chatId: string
  readonly text: string
  readonly replyMarkup?: InlineKeyboardMarkup
}

export type SendResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly status: number | null; readonly action: FailureAction }

/** Функция отправки как зависимость: в тестах подменяется заглушкой. */
export type SendMessage = (message: OutgoingMessage) => Promise<SendResult>

type Fetch = (input: string, init: RequestInit) => Promise<Response>

function failure(status: number | null): SendResult {
  return { ok: false, status, action: classifyTelegramFailure(status) }
}

export function createTelegramSender(botToken: string, fetchImpl: Fetch = fetch): SendMessage {
  return async (message) => {
    const body = {
      chat_id: message.chatId,
      text: message.text,
      ...(message.replyMarkup ? { reply_markup: message.replyMarkup } : {}),
    }
    try {
      const response = await fetchImpl(`${TELEGRAM_API}/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      // Тело ответа читаем, чтобы освободить соединение; содержимое не логируем.
      await response.body?.cancel()
      return response.ok ? { ok: true } : failure(response.status)
    } catch {
      // Сеть недоступна или истёк таймаут: сообщение, скорее всего, не ушло — повторим в следующий запуск.
      return failure(null)
    }
  }
}
