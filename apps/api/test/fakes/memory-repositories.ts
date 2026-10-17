import type { BookingStatus, PublicReviewDto } from '@barber/shared'
import { randomUUID } from 'node:crypto'
import type { BarberServiceLink } from '../../src/domain/pricing'
import type {
  BarberProfile,
  BarberRecord,
  BarberWeeklyRange,
  BookingRecord,
  NewBooking,
  NewReview,
  Repositories,
  ServiceRecord,
  TimeOffRecord,
} from '../../src/repositories/types'

/** Состояние «базы» в памяти. Тесты меняют его напрямую. */
export type MemoryState = {
  services: ServiceRecord[]
  barbers: BarberRecord[]
  links: BarberServiceLink[]
  hours: BarberWeeklyRange[]
  breaks: BarberWeeklyRange[]
  timeOff: TimeOffRecord[]
  settings: Record<string, unknown>
  clients: { id: string; name: string; phone: string | null; telegramId: bigint | null }[]
  bookings: (BookingRecord & { reminderDaySentAt: Date | null; reminder30mSentAt: Date | null })[]
  reviews: (NewReview & { id: string; createdAt: Date })[]
}

type StoredBooking = MemoryState['bookings'][number]

/** Ошибка как у PostgreSQL при нарушении bookings_no_overlap. */
function exclusionError(): Error {
  return Object.assign(new Error('conflicting key value violates exclusion constraint "bookings_no_overlap"'), { code: '23P01' })
}

function assertNoOverlap(state: MemoryState, candidate: StoredBooking): void {
  const clash = state.bookings.some(
    other =>
      other.id !== candidate.id &&
      other.status === 'confirmed' &&
      candidate.status === 'confirmed' &&
      other.barberId === candidate.barberId &&
      other.startsAt < candidate.endsAt &&
      candidate.startsAt < other.endsAt,
  )
  if (clash) throw exclusionError()
}

function publicRecord(booking: StoredBooking): BookingRecord {
  const { reminderDaySentAt: _day, reminder30mSentAt: _short, ...record } = booking
  return { ...record, client: { ...record.client }, services: record.services.map(s => ({ ...s })) }
}

function resolveClient(state: MemoryState, input: NewBooking): MemoryState['clients'][number] {
  const ref = input.client
  if (ref.kind === 'existing') {
    const existing = state.clients.find(c => c.id === ref.clientId)
    if (!existing) throw new Error('client not found')
    const updated = { ...existing, name: ref.name, phone: ref.phone }
    state.clients = state.clients.map(c => (c.id === updated.id ? updated : c))
    return updated
  }
  // Как в Prisma-репозитории: гость всегда новый клиент, без поиска по телефону.
  const created = { id: randomUUID(), name: ref.name, phone: ref.phone, telegramId: null }
  state.clients = [...state.clients, created]
  return created
}

function createBooking(state: MemoryState, input: NewBooking): BookingRecord {
  const client = resolveClient(state, input)
  const barber = state.barbers.find(b => b.id === input.barberId)
  const booking: StoredBooking = {
    id: randomUUID(),
    clientId: client.id,
    barberId: input.barberId,
    barberName: barber?.name ?? '',
    client: { name: client.name, phone: client.phone },
    status: 'confirmed',
    source: input.source,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    totalPrice: input.totalPrice,
    totalDurationMin: input.totalDurationMin,
    manageToken: input.manageToken,
    services: input.services.map(s => ({ ...s })),
    createdAt: new Date(),
    reminderDaySentAt: null,
    reminder30mSentAt: null,
  }
  assertNoOverlap(state, booking)
  state.bookings = [...state.bookings, booking]
  return publicRecord(booking)
}

function updateConfirmed(state: MemoryState, id: string, patch: Partial<StoredBooking>): BookingRecord | null {
  const current = state.bookings.find(b => b.id === id)
  if (!current || current.status !== 'confirmed') return null
  const next = { ...current, ...patch }
  assertNoOverlap(state, next)
  state.bookings = state.bookings.map(b => (b.id === id ? next : b))
  return publicRecord(next)
}

function profile(state: MemoryState, barber: BarberRecord): BarberProfile {
  const reviews = state.reviews.filter(r => r.barberId === barber.id)
  const rating = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0
  return {
    ...barber,
    serviceIds: state.links.filter(l => l.barberId === barber.id && l.isEnabled).map(l => l.serviceId),
    portfolio: [],
    rating: Math.round(rating * 10) / 10,
    reviewsCount: reviews.length,
  }
}

const overlaps = (row: { startsAt: Date; endsAt: Date }, from: Date, to: Date): boolean =>
  row.startsAt < to && row.endsAt > from

/** In-memory реализация всех репозиториев с теми же гарантиями, что у базы (23P01, unique). */
export function createMemoryRepositories(state: MemoryState): Repositories {
  const activeBarbers = (): BarberRecord[] => state.barbers.filter(b => b.isActive)
  return {
    catalog: {
      listActiveServices: async () => state.services.filter(s => s.isActive),
      findServicesByIds: async ids => state.services.filter(s => ids.includes(s.id)),
      listActiveBarberProfiles: async () => activeBarbers().map(b => profile(state, b)),
      findBarberProfile: async id => {
        const barber = activeBarbers().find(b => b.id === id)
        return barber ? profile(state, barber) : null
      },
      listActiveBarbers: async ids => activeBarbers().filter(b => !ids || ids.includes(b.id)),
      listBarberServiceLinks: async serviceIds => state.links.filter(l => serviceIds.includes(l.serviceId)),
    },
    schedule: {
      listWorkingHours: async ids => state.hours.filter(h => ids.includes(h.barberId)),
      listBreaks: async ids => state.breaks.filter(h => ids.includes(h.barberId)),
      listTimeOff: async (ids, from, to) =>
        state.timeOff.filter(t => (t.barberId === null || ids.includes(t.barberId)) && overlaps(t, from, to)),
      listConfirmedBookings: async (ids, from, to, excludeId) =>
        state.bookings
          .filter(b => b.status === 'confirmed' && ids.includes(b.barberId) && b.id !== excludeId && overlaps(b, from, to))
          .map(b => ({ barberId: b.barberId, startsAt: b.startsAt, endsAt: b.endsAt })),
    },
    settings: { getAll: async () => ({ ...state.settings }) },
    bookings: {
      create: async input => createBooking(state, input),
      findByToken: async token => {
        const found = state.bookings.find(b => b.manageToken === token)
        return found ? publicRecord(found) : null
      },
      countUpcomingByPhone: async (phone, now) =>
        state.bookings.filter(
          b => b.status === 'confirmed' && b.startsAt > now && state.clients.find(c => c.id === b.clientId)?.phone === phone,
        ).length,
      listByClient: async (clientId, limit) =>
        state.bookings
          .filter(b => b.clientId === clientId)
          .toSorted((a, b) => b.startsAt.getTime() - a.startsAt.getTime())
          .slice(0, limit)
          .map(publicRecord),
      cancel: async id => updateConfirmed(state, id, { status: 'cancelled' }),
      reschedule: async (id, startsAt, endsAt) =>
        updateConfirmed(state, id, { startsAt, endsAt, reminderDaySentAt: null, reminder30mSentAt: null }),
    },
    clients: {
      findOrCreateByTelegram: async input => {
        const existing = state.clients.find(c => c.telegramId === input.telegramId)
        if (existing) return existing
        const created = { id: randomUUID(), name: input.name, phone: null, telegramId: input.telegramId }
        state.clients = [...state.clients, created]
        return created
      },
    },
    reviews: {
      listPublic: async (minRating, limit): Promise<PublicReviewDto[]> =>
        state.reviews
          .filter(r => r.isPublic && r.rating >= minRating)
          .slice(0, limit)
          .map(r => ({
            id: r.id,
            clientName: state.clients.find(c => c.id === r.clientId)?.name ?? '',
            barberId: r.barberId,
            barberName: state.barbers.find(b => b.id === r.barberId)?.name ?? '',
            rating: r.rating,
            comment: r.comment ?? '',
            createdAt: r.createdAt.toISOString(),
          })),
      existsForBooking: async bookingId => state.reviews.some(r => r.bookingId === bookingId),
      create: async input => {
        if (state.reviews.some(r => r.bookingId === input.bookingId)) throw Object.assign(new Error('unique'), { code: 'P2002' })
        const review = { ...input, id: randomUUID(), createdAt: new Date() }
        state.reviews = [...state.reviews, review]
        return { id: review.id }
      },
    },
  }
}

/** Помогает тестам менять статус записи (как это сделает админка или cron). */
export function setBookingStatus(state: MemoryState, id: string, status: BookingStatus): void {
  state.bookings = state.bookings.map(b => (b.id === id ? { ...b, status } : b))
}
