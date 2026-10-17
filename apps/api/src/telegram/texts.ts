import { MAX_ACTIVE_BOOKINGS_PER_PHONE, formatDuration, formatLongDate, formatPrice } from '@barber/shared'
import { dateKeyInZone, timeInZone } from '../domain/time'
import type { BookingRecord } from '../repositories/types'
import { bold, escapeHtml } from './html'

/**
 * Тексты бота (HTML parse_mode). Всё, что приходит из базы или от пользователя, экранируется здесь.
 * Время показывается в часовом поясе салона (settings.timezone, по умолчанию Asia/Tashkent).
 */

const lines = (...parts: readonly string[]): string => parts.join('\n')

/** «понедельник, 12 октября, 10:00». */
export function formatWhen(date: Date, timeZone: string): string {
  const epoch = date.getTime()
  return `${formatLongDate(dateKeyInZone(epoch, timeZone))}, ${timeInZone(epoch, timeZone)}`
}

/** «12.10 10:00» — коротко для кнопок. */
export function formatShortWhen(date: Date, timeZone: string): string {
  const [, month = '', day = ''] = dateKeyInZone(date.getTime(), timeZone).split('-')
  return `${day}.${month} ${timeInZone(date.getTime(), timeZone)}`
}

/** Блок с деталями записи: когда, барбер, услуги, длительность, цена. */
export function bookingDetails(booking: BookingRecord, timeZone: string): string {
  const services = booking.services.map(service => service.name).join(', ')
  return lines(
    `Когда: ${bold(formatWhen(booking.startsAt, timeZone))}`,
    `Барбер: ${escapeHtml(booking.barberName)}`,
    `Услуги: ${escapeHtml(services)}`,
    `Длительность: ${formatDuration(booking.totalDurationMin)}`,
    `Стоимость: ${formatPrice(booking.totalPrice)}`,
  )
}

/** Клиент и телефон — для барбера. */
function clientLine(booking: BookingRecord): string {
  const phone = booking.client.phone ? `, ${escapeHtml(booking.client.phone)}` : ''
  return `Клиент: ${escapeHtml(booking.client.name)}${phone}`
}

export const texts = {
  greeting: (firstName: string): string =>
    lines(
      `Здравствуйте, ${escapeHtml(firstName)}!`,
      '',
      'Я бот барбершопа: помогу записаться на стрижку, напомню о визите и покажу ваши записи.',
      'Выберите действие в меню ниже.',
    ),
  contacts: (siteUrl: string | undefined): string =>
    lines(
      bold('Контакты барбершопа'),
      '',
      'Работаем каждый день, время — по Ташкенту.',
      siteUrl ? `Адрес, телефон и карта — на сайте: ${escapeHtml(siteUrl)}` : 'Адрес и телефон уточняйте у администратора.',
    ),
  noUpcoming: 'У вас нет предстоящих записей. Нажмите «Записаться», чтобы выбрать время.',
  upcomingHeader: (count: number): string => bold(`Ваши предстоящие записи (${count}):`),
  bookingItem: (index: number, booking: BookingRecord, timeZone: string): string =>
    lines(`${index}. ${bookingDetails(booking, timeZone)}`),
  cutoffHint: (cutoffMin: number): string =>
    `Отменить запись в боте можно не позже чем за ${cutoffMin} мин до начала.`,
  confirmCancel: (booking: BookingRecord, timeZone: string): string =>
    lines(bold('Отменить эту запись?'), '', bookingDetails(booking, timeZone)),
  cancelledByUser: (booking: BookingRecord, timeZone: string): string =>
    lines(bold('Запись отменена.'), '', bookingDetails(booking, timeZone)),
  cancelKept: 'Хорошо, запись остаётся в силе.',
  bookingLinked: (booking: BookingRecord, timeZone: string): string =>
    lines(
      bold('Запись привязана к Telegram.'),
      '',
      bookingDetails(booking, timeZone),
      '',
      'Сюда придут подтверждения и напоминания: за день и за 30 минут до визита.',
    ),
  bookingNotFound: 'Запись не найдена. Проверьте ссылку или запишитесь заново.',
  confirmAskContact: (booking: BookingRecord, timeZone: string): string =>
    lines(
      bold('Подтвердите запись'),
      '',
      bookingDetails(booking, timeZone),
      '',
      'Нажмите кнопку «📱 Поделиться номером» внизу — так мы убедимся, что номер ваш.',
      booking.holdExpiresAt
        ? `Время держим до ${escapeHtml(timeInZone(booking.holdExpiresAt.getTime(), timeZone))}.`
        : '',
    ),
  confirmExpired: 'Время на подтверждение истекло, время освобождено. Запишитесь заново на сайте.',
  confirmTooMany: `На ваш номер уже ${MAX_ACTIVE_BOOKINGS_PER_PHONE} предстоящие записи. Отмените одну из них, чтобы подтвердить новую.`,
  contactForeign: 'Нужен ваш собственный номер: нажмите кнопку «📱 Поделиться номером» внизу. Чужой контакт не подходит.',
  contactNotUz: (siteUrl: string | undefined): string =>
    `Онлайн-запись доступна только для номеров Узбекистана (+998). Запишитесь по телефону${siteUrl ? ` — он есть на сайте ${siteUrl}` : ' у администратора'}.`,
  phoneVerified: (confirmed: number, tooMany: number, expired: number): string =>
    [
      'Номер подтверждён ✅',
      confirmed > 0 ? 'Запись подтверждена — детали пришлём следующим сообщением.' : '',
      confirmed === 0 && tooMany === 0 && expired === 0 ? 'Теперь можно записываться в приложении.' : '',
      tooMany > 0 ? `Не подтвердили запись: на номер уже ${MAX_ACTIVE_BOOKINGS_PER_PHONE} предстоящие записи.` : '',
      expired > 0 ? 'Время на подтверждение записи истекло — запишитесь заново.' : '',
    ]
      .filter(Boolean)
      .join('\n'),
  bookingLinkConflict:
    'Эта запись уже привязана к другому аккаунту Telegram. Если это ошибка, свяжитесь с администратором.',
  barberLinked: (barberName: string): string =>
    lines(
      bold('Готово!'),
      `Уведомления о записях к барберу ${escapeHtml(barberName)} будут приходить в этот чат.`,
    ),
  barberLinkInvalid: 'Ссылка привязки недействительна: она устарела или уже использована. Попросите администратора новую.',
  notYourBooking: 'Эта запись принадлежит другому клиенту.',
  ratingThanks: (rating: number): string =>
    `Спасибо за оценку: ${'★'.repeat(rating)}${'☆'.repeat(5 - rating)} (${rating} из 5)!`,
  commentPrompt: (markerUrl: string): string =>
    lines(
      `Хотите добавить комментарий к <a href="${escapeHtml(markerUrl)}">отзыву</a>?`,
      'Ответьте на это сообщение — просто напишите текст.',
    ),
  commentHowTo: 'Чтобы добавить комментарий, ответьте на сообщение бота с вопросом о комментарии.',
  commentSaved: 'Комментарий сохранён. Спасибо, что помогаете нам становиться лучше!',
  commentAlreadySet: 'Комментарий к этому отзыву уже добавлен.',
  commentTooLong: (max: number): string => `Комментарий слишком длинный: максимум ${max} символов.`,
  reviewNotReady: 'Оценить визит можно после того, как он состоится.',
  reviewAlreadyLeft: 'Вы уже оценили этот визит. Спасибо!',
  somethingWrong: 'Что-то пошло не так. Попробуйте ещё раз чуть позже.',
} as const

/** Уведомления клиенту и барберу (Notifier). */
export const notificationTexts = {
  clientCreated: (b: BookingRecord, tz: string): string =>
    lines(bold('Запись подтверждена!'), '', bookingDetails(b, tz), '', 'Ждём вас. Напомним о визите заранее.'),
  clientCancelled: (b: BookingRecord, tz: string): string =>
    lines(bold('Запись отменена.'), '', bookingDetails(b, tz), '', 'Будем рады видеть вас в другое время.'),
  clientRescheduled: (b: BookingRecord, oldStartsAt: Date, tz: string): string =>
    lines(
      bold('Запись перенесена.'),
      `Было: ${escapeHtml(formatWhen(oldStartsAt, tz))}`,
      '',
      bookingDetails(b, tz),
    ),
  barberCreated: (b: BookingRecord, tz: string): string =>
    lines(bold('Новая запись'), '', bookingDetails(b, tz), clientLine(b)),
  barberCancelled: (b: BookingRecord, tz: string): string =>
    lines(bold('Запись отменена'), '', bookingDetails(b, tz), clientLine(b)),
  barberRescheduled: (b: BookingRecord, oldStartsAt: Date, tz: string): string =>
    lines(
      bold('Запись перенесена'),
      `Было: ${escapeHtml(formatWhen(oldStartsAt, tz))}`,
      '',
      bookingDetails(b, tz),
      clientLine(b),
    ),
} as const
