import type { FastifyBaseLogger } from 'fastify'
import type { BookingRecord } from '../repositories/types'

/**
 * Точка расширения для Telegram-бота (этап 7): уведомления клиенту и барберу.
 * Вызывается только после успешного коммита. Ошибки уведомлений не ломают запрос.
 */
export interface Notifier {
  bookingCreated(booking: BookingRecord): Promise<void>
  bookingCancelled(booking: BookingRecord): Promise<void>
  bookingRescheduled(booking: BookingRecord, oldStartsAt: Date): Promise<void>
}

/** Ничего не отправляет — используется, пока бот не подключён. */
export const noopNotifier: Notifier = {
  bookingCreated: async () => undefined,
  bookingCancelled: async () => undefined,
  bookingRescheduled: async () => undefined,
}

/**
 * Выполняет уведомление и проглатывает ошибку, записав её в лог.
 * Ждём завершения (await), потому что на Vercel фоновые промисы после ответа могут не выполниться.
 */
export async function safeNotify(
  log: FastifyBaseLogger,
  event: string,
  bookingId: string,
  send: () => Promise<void>,
): Promise<void> {
  try {
    await send()
  } catch (error: unknown) {
    log.error({ err: error, event, bookingId }, 'Не удалось отправить уведомление')
  }
}
