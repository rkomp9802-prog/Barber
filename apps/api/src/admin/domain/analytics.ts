import type {
  CancellationsAnalyticsDto,
  HeatmapAnalyticsDto,
  LoadAnalyticsDto,
  RetentionAnalyticsDto,
  RevenueAnalyticsDto,
  ServicesAnalyticsDto,
} from '@barber/shared'
import { MINUTE_MS, dateKeyInZone, timeInZone, weekdayOfKey } from '../../domain/time'
import type { AnalyticsBooking, ClientVisitStat } from '../repositories/types'

/**
 * Расчёты аналитики (tasks-final.md этап 10). Все функции чистые: на вход — записи периода,
 * на выход — DTO из @barber/shared. Деньги и выручка считаются только по completed-записям.
 */

/** Доля в процентах с одним знаком после запятой; 0, если знаменатель 0. */
export function percent(part: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((part / total) * 1000) / 10
}

function completedOnly(bookings: readonly AnalyticsBooking[]): AnalyticsBooking[] {
  return bookings.filter(booking => booking.status === 'completed')
}

export function revenueOf(bookings: readonly AnalyticsBooking[]): RevenueAnalyticsDto {
  const completed = completedOnly(bookings)
  const totalRevenue = completed.reduce((sum, booking) => sum + booking.totalPrice, 0)
  return {
    totalRevenue,
    completedCount: completed.length,
    averageCheck: completed.length === 0 ? 0 : Math.round(totalRevenue / completed.length),
  }
}

export function servicesOf(bookings: readonly AnalyticsBooking[]): ServicesAnalyticsDto {
  const counts = new Map<string, { serviceName: string; bookingsCount: number }>()
  for (const booking of completedOnly(bookings)) {
    for (const service of booking.services) {
      const current = counts.get(service.serviceId)
      counts.set(service.serviceId, {
        serviceName: current?.serviceName ?? service.name,
        bookingsCount: (current?.bookingsCount ?? 0) + 1,
      })
    }
  }
  const total = [...counts.values()].reduce((sum, item) => sum + item.bookingsCount, 0)
  const services = [...counts.entries()]
    .map(([serviceId, item]) => ({ serviceId, ...item, sharePercent: percent(item.bookingsCount, total) }))
    .sort((a, b) => b.bookingsCount - a.bookingsCount || a.serviceName.localeCompare(b.serviceName, 'ru'))
  return { services }
}

export function loadOf(bookings: readonly AnalyticsBooking[]): LoadAnalyticsDto {
  const byBarber = new Map<string, { barberName: string; workedMinutes: number; completedCount: number; revenue: number }>()
  for (const booking of completedOnly(bookings)) {
    const current = byBarber.get(booking.barberId) ?? { barberName: booking.barberName, workedMinutes: 0, completedCount: 0, revenue: 0 }
    byBarber.set(booking.barberId, {
      barberName: current.barberName,
      workedMinutes: current.workedMinutes + Math.round((booking.endsAt.getTime() - booking.startsAt.getTime()) / MINUTE_MS),
      completedCount: current.completedCount + 1,
      revenue: current.revenue + booking.totalPrice,
    })
  }
  const barbers = [...byBarber.entries()]
    .map(([barberId, item]) => ({ barberId, ...item }))
    .sort((a, b) => b.revenue - a.revenue || a.barberName.localeCompare(b.barberName, 'ru'))
  return { barbers }
}

export function cancellationsOf(bookings: readonly AnalyticsBooking[]): CancellationsAnalyticsDto {
  const cancelledCount = bookings.filter(booking => booking.status === 'cancelled').length
  const noShowCount = bookings.filter(booking => booking.status === 'no_show').length
  return {
    cancelledCount,
    noShowCount,
    totalBookings: bookings.length,
    cancelledPercent: percent(cancelledCount, bookings.length),
    noShowPercent: percent(noShowCount, bookings.length),
  }
}

/**
 * Возвращаемость: берём клиентов с completed-визитом в периоде и смотрим,
 * сколько у каждого completed-визитов за всё время до конца периода.
 * 1 визит — разовый клиент, 2+ — вернувшийся.
 */
export function retentionOf(stats: readonly ClientVisitStat[]): RetentionAnalyticsDto {
  const returningClients = stats.filter(stat => stat.visits >= 2).length
  const oneTimeClients = stats.filter(stat => stat.visits === 1).length
  return {
    oneTimeClients,
    returningClients,
    retentionRate: percent(returningClients, oneTimeClients + returningClients),
  }
}

/** Уникальные клиенты с completed-записями — вход для clientVisitStats. */
export function completedClientIds(bookings: readonly AnalyticsBooking[]): string[] {
  return [...new Set(completedOnly(bookings).map(booking => booking.clientId))]
}

/** Heatmap «день недели × час» по местному времени салона; 0 = понедельник. Пустые ячейки не возвращаем. */
export function heatmapOf(bookings: readonly AnalyticsBooking[], timeZone: string): HeatmapAnalyticsDto {
  const counts = new Map<string, number>()
  for (const booking of completedOnly(bookings)) {
    const epoch = booking.startsAt.getTime()
    const dayOfWeek = (weekdayOfKey(dateKeyInZone(epoch, timeZone)) + 6) % 7
    const hour = Number(timeInZone(epoch, timeZone).slice(0, 2))
    const key = `${dayOfWeek}:${hour}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const cells = [...counts.entries()]
    .map(([key, bookingsCount]) => {
      const [dayOfWeek, hour] = key.split(':').map(Number) as [number, number]
      return { dayOfWeek, hour, bookingsCount }
    })
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.hour - b.hour)
  return { cells }
}
