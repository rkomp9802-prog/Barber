import type { BookingSource, BookingStatus } from '@barber/shared'

export const BOOKING_STATUS_LABELS: Readonly<Record<BookingStatus, string>> = {
  pending: 'Ждёт подтверждения',
  confirmed: 'Подтверждена',
  completed: 'Завершена',
  cancelled: 'Отменена',
  no_show: 'Не пришёл',
}

export const BOOKING_SOURCE_LABELS: Readonly<Record<BookingSource, string>> = {
  web: 'Сайт',
  telegram: 'Telegram',
  admin: 'Админка',
}

export type StatusTone = 'accent' | 'success' | 'danger' | 'muted'

export const BOOKING_STATUS_TONES: Readonly<Record<BookingStatus, StatusTone>> = {
  pending: 'muted',
  confirmed: 'accent',
  completed: 'success',
  cancelled: 'danger',
  no_show: 'muted',
}

export function bookingStatusLabel(status: BookingStatus): string {
  return BOOKING_STATUS_LABELS[status]
}

export function bookingSourceLabel(source: BookingSource): string {
  return BOOKING_SOURCE_LABELS[source]
}
