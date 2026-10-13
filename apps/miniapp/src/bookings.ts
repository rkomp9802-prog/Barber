import { type BookingDto, type BookingStatus, TIMEZONE, tashkentDateKey } from '@barber/shared'

export type BadgeTone = 'accent' | 'success' | 'muted' | 'danger'

export const STATUS_LABELS: Readonly<Record<BookingStatus, { label: string; tone: BadgeTone }>> = {
  confirmed: { label: 'Подтверждена', tone: 'accent' },
  completed: { label: 'Завершена', tone: 'success' },
  cancelled: { label: 'Отменена', tone: 'muted' },
  no_show: { label: 'Неявка', tone: 'danger' },
}

const timeFormatter = new Intl.DateTimeFormat('ru-RU', {
  timeZone: TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

/** '2026-10-11T09:30:00Z' → '14:30' (по Ташкенту). */
export function formatTashkentTime(iso: string): string {
  return timeFormatter.format(new Date(iso))
}

/** День записи 'YYYY-MM-DD' по Ташкенту. */
export function bookingDateKey(iso: string): string {
  return tashkentDateKey(new Date(iso))
}

export function isUpcoming(booking: BookingDto, now: Date): boolean {
  return booking.status === 'confirmed' && new Date(booking.endsAt).getTime() > now.getTime()
}

/** Сначала предстоящие (ближайшая первой), затем прошедшие и отменённые (свежие первыми). */
export function sortBookings(bookings: readonly BookingDto[], now: Date): BookingDto[] {
  const time = (booking: BookingDto): number => new Date(booking.startsAt).getTime()
  const upcoming = bookings.filter(b => isUpcoming(b, now)).sort((a, b) => time(a) - time(b))
  const past = bookings.filter(b => !isUpcoming(b, now)).sort((a, b) => time(b) - time(a))
  return [...upcoming, ...past]
}

/** Заменяет запись в списке на обновлённую версию (без мутации исходного массива). */
export function replaceBooking(bookings: readonly BookingDto[], updated: BookingDto): BookingDto[] {
  return bookings.map(booking => (booking.id === updated.id ? updated : booking))
}
