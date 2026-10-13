import type { Api } from 'grammy'
import { parseBookingRules } from '../domain/settings'
import type { Notifier } from '../notifications/notifier'
import type { BookingRecord, SettingsRepository } from '../repositories/types'
import type { TelegramRepository } from './repository'
import { notificationTexts } from './texts'

/** Минимальный логгер (совместим с FastifyBaseLogger / pino). */
export type NotifierLogger = {
  error(obj: object, msg: string): void
}

export type TelegramNotifierDeps = {
  readonly api: Pick<Api, 'sendMessage'>
  readonly repo: TelegramRepository
  readonly settings: SettingsRepository
  /** Функцией — потому что логгер Fastify появляется после создания уведомлений (см. setup.ts). */
  readonly log: () => NotifierLogger
}

type Recipient = 'client' | 'barber'
type Message = { readonly recipient: Recipient; readonly text: string }

/** Клиент: только telegram_chat_id (его записывает бот). Без него уведомление пропускается. */
async function clientChatId(repo: TelegramRepository, clientId: string): Promise<bigint | null> {
  const client = await repo.findClientById(clientId)
  return client?.telegramChatId ?? null
}

/** Барбер: barbers.telegram_chat_id (одноразовая привязка barber_<code>). */
async function chatIdFor(repo: TelegramRepository, booking: BookingRecord, recipient: Recipient): Promise<bigint | null> {
  return recipient === 'client' ? clientChatId(repo, booking.clientId) : repo.findBarberChatId(booking.barberId)
}

/** Отправляет одно сообщение; любая ошибка (нет чата, бот заблокирован, сеть) только логируется. */
async function deliver(deps: TelegramNotifierDeps, booking: BookingRecord, event: string, message: Message): Promise<void> {
  try {
    const chatId = await chatIdFor(deps.repo, booking, message.recipient)
    if (chatId === null) return
    await deps.api.sendMessage(Number(chatId), message.text, {
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
    })
  } catch (error: unknown) {
    deps.log().error(
      { err: error, event, bookingId: booking.id, recipient: message.recipient },
      'Не удалось отправить Telegram-уведомление',
    )
  }
}

async function timezoneOf(deps: TelegramNotifierDeps): Promise<string> {
  return parseBookingRules(await deps.settings.getAll()).timezone
}

type Compose = (booking: BookingRecord, timeZone: string) => readonly Message[]

/** Клиенту и барберу — независимо: неудача одного не мешает другому. Метод никогда не бросает. */
function notify(deps: TelegramNotifierDeps, event: string, compose: Compose) {
  return async (booking: BookingRecord): Promise<void> => {
    try {
      const messages = compose(booking, await timezoneOf(deps))
      await Promise.all(messages.map(message => deliver(deps, booking, event, message)))
    } catch (error: unknown) {
      deps.log().error({ err: error, event, bookingId: booking.id }, 'Не удалось подготовить Telegram-уведомление')
    }
  }
}

/** Реализация Notifier через Telegram-бота: подтверждение, отмена, перенос — клиенту и барберу. */
export function createTelegramNotifier(deps: TelegramNotifierDeps): Notifier {
  const created = notify(deps, 'bookingCreated', (b, tz) => [
    { recipient: 'client', text: notificationTexts.clientCreated(b, tz) },
    { recipient: 'barber', text: notificationTexts.barberCreated(b, tz) },
  ])
  const cancelled = notify(deps, 'bookingCancelled', (b, tz) => [
    { recipient: 'client', text: notificationTexts.clientCancelled(b, tz) },
    { recipient: 'barber', text: notificationTexts.barberCancelled(b, tz) },
  ])
  return {
    bookingCreated: created,
    bookingCancelled: cancelled,
    bookingRescheduled: (booking, oldStartsAt) =>
      notify(deps, 'bookingRescheduled', (b, tz) => [
        { recipient: 'client', text: notificationTexts.clientRescheduled(b, oldStartsAt, tz) },
        { recipient: 'barber', text: notificationTexts.barberRescheduled(b, oldStartsAt, tz) },
      ])(booking),
  }
}
