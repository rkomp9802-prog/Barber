import { tashkentDateKey, type BookingDto, type BookingStatus } from '@barber/shared'

import { tashkentTime } from '@/lib/datetime'

export const BOOKING_STATUS_LABELS: Readonly<Record<BookingStatus, string>> = {
  pending: 'Ждёт подтверждения в Telegram',
  confirmed: 'Подтверждена',
  completed: 'Завершена',
  cancelled: 'Отменена',
  no_show: 'Клиент не пришёл',
}

export type StatusTone = 'active' | 'done' | 'closed'

export function statusTone(status: BookingStatus): StatusTone {
  if (status === 'confirmed' || status === 'pending') return 'active'
  if (status === 'completed') return 'done'
  return 'closed'
}

/** Запись ждёт, пока клиент подтвердит номер в Telegram. */
export function isPendingBooking(booking: Pick<BookingDto, 'status'>): boolean {
  return booking.status === 'pending'
}

/** Сколько миллисекунд осталось на подтверждение; 0 — время вышло. */
export function holdRemainingMs(holdExpiresAt: string | null, now: number): number {
  return holdExpiresAt ? Math.max(0, Date.parse(holdExpiresAt) - now) : 0
}

/** 9:05 — минуты и секунды до конца удержания. */
export function formatCountdown(ms: number): string {
  const totalSec = Math.ceil(ms / 1000)
  return `${Math.floor(totalSec / 60)}:${String(totalSec % 60).padStart(2, '0')}`
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
