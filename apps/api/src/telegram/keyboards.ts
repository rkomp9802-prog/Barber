import { InlineKeyboard, Keyboard } from 'grammy'
import type { BookingRecord } from '../repositories/types'
import { formatShortWhen } from './texts'

/** Подписи кнопок главного меню (reply keyboard): по ним же бот узнаёт нажатия. */
export const MENU = {
  book: 'Записаться',
  bookings: 'Мои записи',
  contacts: 'Контакты',
} as const

/** callback_data кнопок бота. Все варианты укладываются в лимит Telegram 64 байта (uuid = 36). */
export const CALLBACK = {
  cancelAsk: 'cxl',
  cancelYes: 'cxl_yes',
  cancelNo: 'cxl_no',
} as const

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'

export const CALLBACK_PATTERNS = {
  rate: new RegExp(`^rate:(${UUID}):([1-5])$`),
  cancelAsk: new RegExp(`^${CALLBACK.cancelAsk}:(${UUID})$`),
  cancelYes: new RegExp(`^${CALLBACK.cancelYes}:(${UUID})$`),
  cancelNo: new RegExp(`^${CALLBACK.cancelNo}$`),
} as const

/** Telegram открывает Web App и url-кнопки только по https. */
export function isHttpsUrl(url: string | undefined): url is string {
  return typeof url === 'string' && url.startsWith('https://')
}

/** Главное меню: «Записаться» (Mini App), «Мои записи», «Контакты». */
/** Кнопка отправки собственного номера (Telegram пришлёт контакт с user_id отправителя). */
export const CONTACT_BUTTON = '📱 Поделиться номером'

export function contactRequestKeyboard(): Keyboard {
  return new Keyboard().requestContact(CONTACT_BUTTON).resized().oneTime()
}

export function mainMenu(miniAppUrl: string | undefined): Keyboard {
  const base = isHttpsUrl(miniAppUrl) ? new Keyboard().webApp(MENU.book, miniAppUrl).row() : new Keyboard()
  return base.text(MENU.bookings).text(MENU.contacts).resized().persistent()
}

export type BookingButtonsInput = {
  readonly booking: BookingRecord
  readonly canCancel: boolean
  readonly timeZone: string
  readonly appUrl: string | undefined
}

/** Под каждой записью: «Отменить» (если ещё можно) и «Перенести» — страница управления на сайте. */
export function bookingsKeyboard(items: readonly BookingButtonsInput[]): InlineKeyboard {
  return items.reduce((keyboard, item) => {
    const when = formatShortWhen(item.booking.startsAt, item.timeZone)
    const withCancel = item.canCancel
      ? keyboard.text(`Отменить ${when}`, `${CALLBACK.cancelAsk}:${item.booking.id}`)
      : keyboard
    const withManage = isHttpsUrl(item.appUrl)
      ? withCancel.url(`Перенести ${when}`, `${item.appUrl}/booking/${item.booking.manageToken}`)
      : withCancel
    return withManage.row()
  }, new InlineKeyboard())
}

export function confirmCancelKeyboard(bookingId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text('Да, отменить', `${CALLBACK.cancelYes}:${bookingId}`)
    .text('Нет, оставить', CALLBACK.cancelNo)
}
