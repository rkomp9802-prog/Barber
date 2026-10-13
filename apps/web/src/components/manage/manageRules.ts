import { tashkentDateKey, type BookingDto, type BookingStatus } from '@barber/shared'

import { tashkentTime } from '@/lib/datetime'

export const BOOKING_STATUS_LABELS: Readonly<Record<BookingStatus, string>> = {
  confirmed: 'Подтверждена',
  completed: 'Завершена',
  cancelled: 'Отменена',
  no_show: 'Клиент не пришёл',
}

export type StatusTone = 'active' | 'done' | 'closed'

export function statusTone(status: BookingStatus): StatusTone {
  if (status === 'confirmed') return 'active'
  if (status === 'completed') return 'done'
  return 'closed'
}

/** Запись действует: её ещё можно посетить и, если разрешено сервером, изменить. */
export function isActiveBooking(booking: Pick<BookingDto, 'status'>): boolean {
  return booking.status === 'confirmed'
}

/** Кнопки «Перенести» и «Отменить» показываем только для активной записи, которую сервер ещё разрешает менять. */
export function canShowActions(booking: Pick<BookingDto, 'status' | 'canChange'>): boolean {
  return isActiveBooking(booking) && booking.canChange
}

/** Запись активна, но онлайн-изменение уже закрыто (меньше cancel_cutoff_min до визита). */
export function needsPhoneCall(booking: Pick<BookingDto, 'status' | 'canChange'>): boolean {
  return isActiveBooking(booking) && !booking.canChange
}

/** Дата визита по Ташкенту: YYYY-MM-DD. */
export function bookingDateKey(startsAt: string): string {
  return tashkentDateKey(new Date(startsAt))
}

/** Время по Ташкенту: HH:MM. */
export function bookingClock(iso: string): string {
  return tashkentTime(new Date(iso))
}

/** Короткий номер записи для глаз клиента: первые символы UUID. */
export function bookingCode(id: string): string {
  return id.slice(0, 8).toUpperCase()
}
