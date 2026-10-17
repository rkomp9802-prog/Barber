import { quoteForBarber, uniqueIds, type Quote } from '../domain/pricing'
import type { BarberCalendar } from '../domain/slots'
import type { Interval } from '../domain/time'
import { AppError } from '../errors'
import type { BarberWeeklyRange, Repositories } from '../repositories/types'

/** Барбер, который может выполнить выбранные услуги, и его цена/длительность. */
export type QuotedBarber = { readonly barberId: string; readonly sortOrder: number; readonly quote: Quote }

/**
 * Загружает услуги и подходящих барберов. Цена и длительность считаются только на сервере
 * (с учётом переопределений в barber_services).
 */
export async function quoteBarbers(
  repos: Repositories,
  serviceIds: readonly string[],
  barberChoice: string,
): Promise<QuotedBarber[]> {
  const ids = uniqueIds(serviceIds)
  const found = await repos.catalog.findServicesByIds(ids)
  const services = ids.map(id => found.find(service => service.id === id))
  if (services.some(service => !service || !service.isActive)) {
    throw new AppError('SERVICE_UNAVAILABLE', 'Услуга не найдена или недоступна')
  }
  const explicit = barberChoice !== 'any'
  const barbers = await repos.catalog.listActiveBarbers(explicit ? [barberChoice] : undefined)
  if (explicit && barbers.length === 0) throw new AppError('NOT_FOUND', 'Барбер не найден')
  const links = await repos.catalog.listBarberServiceLinks(ids)
  const catalog = services.filter(service => service !== undefined)
  const quoted = barbers.flatMap(barber => {
    const quote = quoteForBarber(barber.id, catalog, links)
    return quote ? [{ barberId: barber.id, sortOrder: barber.sortOrder, quote }] : []
  })
  if (explicit && quoted.length === 0) throw new AppError('SERVICE_UNAVAILABLE')
  return quoted
}

function forBarber(ranges: readonly BarberWeeklyRange[], barberId: string): BarberWeeklyRange[] {
  return ranges.filter(range => range.barberId === barberId)
}

const toInterval = (row: { startsAt: Date; endsAt: Date }): Interval => ({
  start: row.startsAt.getTime(),
  end: row.endsAt.getTime(),
})

/** Собирает календари барберов (график, обеды, исключения, записи) для диапазона [from, to). */
export async function loadCalendars(
  repos: Repositories,
  quoted: readonly QuotedBarber[],
  range: Interval,
  now: number,
  excludeBookingId?: string,
): Promise<BarberCalendar[]> {
  if (quoted.length === 0) return []
  const ids = quoted.map(q => q.barberId)
  const from = new Date(range.start)
  const to = new Date(range.end)
  const [hours, breaks, timeOff, bookings] = await Promise.all([
    repos.schedule.listWorkingHours(ids),
    repos.schedule.listBreaks(ids),
    repos.schedule.listTimeOff(ids, from, to),
    repos.schedule.listBusyBookings(ids, from, to, new Date(now), excludeBookingId),
  ])
  return quoted.map(q => ({
    barberId: q.barberId,
    sortOrder: q.sortOrder,
    quote: q.quote,
    workingHours: forBarber(hours, q.barberId),
    breaks: forBarber(breaks, q.barberId),
    timeOff: timeOff.filter(t => t.barberId === null || t.barberId === q.barberId).map(toInterval),
    bookings: bookings.filter(b => b.barberId === q.barberId).map(toInterval),
  }))
}
