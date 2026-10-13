import { hash } from '@node-rs/argon2'
import { randomUUID } from 'node:crypto'
import type { BookingStatus } from '@barber/shared'
import type { BarberServiceLink } from '../../src/domain/pricing'
import type { BookingRecord, Repositories } from '../../src/repositories/types'
import type {
  AdminBarberData,
  AdminBarberLinkRecord,
  AdminBarberRecord,
  AdminReviewRecord,
  AdminRepositories,
  AdminServiceData,
  AdminServiceRecord,
  AdminTimeOffData,
  AdminTimeOffRecord,
  BookingFilter,
  PortfolioItemRecord,
  ReviewFilter,
  TimeOffFilter,
} from '../../src/admin/repositories/types'
import { createMemoryRepositories, type MemoryState } from '../fakes/memory-repositories'
import { demoState } from '../fakes/seed-state'

export const ADMIN_LOGIN = 'owner'
export const ADMIN_PASSWORD = 'correct-horse-battery'

/** Состояние админки: поверх общего MemoryState (записи, барберы, услуги — одни и те же массивы). */
export type AdminMemoryState = MemoryState & {
  adminUsers: { id: string; login: string; passwordHash: string }[]
  sessions: { tokenHash: string; adminUserId: string; expiresAt: Date }[]
  portfolio: (PortfolioItemRecord & { barberId: string })[]
  telegramLinked: Set<string>
  adminTimeOff: AdminTimeOffRecord[]
  linkCodes: { code: string; barberId: string; expiresAt: Date }[]
}

const ADMIN_USER_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
let passwordHashCache: Promise<string> | undefined

function adminPasswordHash(): Promise<string> {
  passwordHashCache ??= hash(ADMIN_PASSWORD)
  return passwordHashCache
}

/** Демо-барбершоп + администратор с Argon2-хешем пароля. */
export async function createAdminState(): Promise<AdminMemoryState> {
  return {
    ...demoState(),
    adminUsers: [{ id: ADMIN_USER_ID, login: ADMIN_LOGIN, passwordHash: await adminPasswordHash() }],
    sessions: [],
    portfolio: [],
    telegramLinked: new Set(),
    adminTimeOff: [],
    linkCodes: [],
  }
}

/** Публичный список исключений (time_off) держим в синхроне с админским. */
function syncTimeOff(state: AdminMemoryState): void {
  state.timeOff = state.adminTimeOff.map(item => ({ barberId: item.barberId, startsAt: item.startsAt, endsAt: item.endsAt }))
}

function serviceName(state: AdminMemoryState, serviceId: string): AdminServiceRecord | undefined {
  return state.services.find(service => service.id === serviceId)
}

function barberRecord(state: AdminMemoryState, barberId: string): AdminBarberRecord | null {
  const barber = state.barbers.find(item => item.id === barberId)
  if (!barber) return null
  const services: AdminBarberLinkRecord[] = state.links
    .filter(link => link.barberId === barberId)
    .map(link => {
      const service = serviceName(state, link.serviceId)
      return {
        serviceId: link.serviceId,
        serviceName: service?.name ?? '',
        serviceDurationMin: service?.durationMin ?? 0,
        servicePrice: service?.price ?? 0,
        isEnabled: link.isEnabled,
        durationMin: link.durationMin,
        price: link.price,
      }
    })
  const hours = state.hours.filter(range => range.barberId === barberId).map(({ weekday, startTime, endTime }) => ({ weekday, startTime, endTime }))
  const breaks = state.breaks.filter(range => range.barberId === barberId).map(({ weekday, startTime, endTime }) => ({ weekday, startTime, endTime }))
  return {
    ...barber,
    telegramLinked: state.telegramLinked.has(barberId),
    services,
    portfolio: state.portfolio.filter(item => item.barberId === barberId).map(({ id, imageUrl, sortOrder }) => ({ id, imageUrl, sortOrder })),
    workingHours: hours,
    breaks,
  }
}

function matchesSearch(state: AdminMemoryState, booking: BookingRecord, search: string): boolean {
  const digits = search.replace(/\D/g, '')
  const name = booking.client.name.toLowerCase().includes(search.toLowerCase())
  const phone = digits.length > 0 && (booking.client.phone ?? '').includes(digits)
  return name || phone
}

function matchesBookingFilter(state: AdminMemoryState, booking: BookingRecord, filter: BookingFilter): boolean {
  if (filter.from && booking.startsAt < filter.from) return false
  if (filter.to && booking.startsAt >= filter.to) return false
  if (filter.barberId && booking.barberId !== filter.barberId) return false
  if (filter.statuses && !filter.statuses.includes(booking.status)) return false
  if (filter.source && booking.source !== filter.source) return false
  if (filter.search && !matchesSearch(state, booking, filter.search)) return false
  return true
}

function publicBooking(booking: MemoryState['bookings'][number]): BookingRecord {
  const { reminderDaySentAt: _day, reminder30mSentAt: _short, ...record } = booking
  return { ...record, client: { ...record.client }, services: record.services.map(s => ({ ...s })) }
}

function overlapsRange(row: { startsAt: Date; endsAt: Date }, from: Date, to: Date): boolean {
  return row.startsAt < to && row.endsAt > from
}

function reviewRecord(state: AdminMemoryState, review: MemoryState['reviews'][number]): AdminReviewRecord {
  const booking = state.bookings.find(item => item.id === review.bookingId)
  const client = state.clients.find(item => item.id === review.clientId)
  const barber = state.barbers.find(item => item.id === review.barberId)
  return {
    id: review.id,
    bookingId: review.bookingId,
    bookingStartsAt: booking?.startsAt ?? new Date(0),
    barberId: review.barberId,
    barberName: barber?.name ?? '',
    clientName: client?.name ?? '',
    clientPhone: client?.phone ?? null,
    rating: review.rating,
    comment: review.comment,
    isPublic: review.isPublic,
    createdAt: review.createdAt,
  }
}

function catalogRepo(state: AdminMemoryState): AdminRepositories['services'] {
  const sorted = (): AdminServiceRecord[] => [...state.services].toSorted((a, b) => a.sortOrder - b.sortOrder)
  return {
    list: async () => sorted(),
    findById: async id => state.services.find(service => service.id === id) ?? null,
    create: async (data: AdminServiceData) => {
      const created = { id: randomUUID(), ...data }
      state.services = [...state.services, created]
      return created
    },
    update: async (id, patch) => {
      const current = state.services.find(service => service.id === id)
      if (!current) return null
      const next = { ...current, ...patch }
      state.services = state.services.map(service => (service.id === id ? next : service))
      return next
    },
  }
}

function barberRepo(state: AdminMemoryState): AdminRepositories['barbers'] {
  const records = (): AdminBarberRecord[] =>
    state.barbers.flatMap(barber => {
      const record = barberRecord(state, barber.id)
      return record ? [record] : []
    })
  return {
    list: async () => records(),
    findById: async id => barberRecord(state, id),
    create: async (data: AdminBarberData) => {
      const id = randomUUID()
      state.barbers = [...state.barbers, { id, ...data }]
      const record = barberRecord(state, id)
      if (!record) throw new Error('barber was not stored')
      return record
    },
    update: async (id, patch) => {
      const current = state.barbers.find(barber => barber.id === id)
      if (!current) return null
      state.barbers = state.barbers.map(barber => (barber.id === id ? { ...barber, ...patch } : barber))
      return barberRecord(state, id)
    },
    replaceServices: async (id, services) => {
      const others = state.links.filter(link => link.barberId !== id)
      const next: BarberServiceLink[] = services.map(service => ({ barberId: id, ...service }))
      state.links = [...others, ...next]
    },
    replaceSchedule: async (id, schedule) => {
      state.hours = [...state.hours.filter(r => r.barberId !== id), ...schedule.workingHours.map(r => ({ barberId: id, ...r }))]
      state.breaks = [...state.breaks.filter(r => r.barberId !== id), ...schedule.breaks.map(r => ({ barberId: id, ...r }))]
    },
    addPortfolioItem: async (barberId, imageUrl) => {
      const sortOrder = state.portfolio.filter(item => item.barberId === barberId).length
      const item = { id: randomUUID(), barberId, imageUrl, sortOrder }
      state.portfolio = [...state.portfolio, item]
      return { id: item.id, imageUrl, sortOrder }
    },
    deletePortfolioItem: async itemId => {
      const before = state.portfolio.length
      state.portfolio = state.portfolio.filter(item => item.id !== itemId)
      return state.portfolio.length < before
    },
    reorderPortfolio: async (barberId, itemIds) => {
      state.portfolio = state.portfolio.map(item =>
        item.barberId === barberId && itemIds.includes(item.id) ? { ...item, sortOrder: itemIds.indexOf(item.id) } : item,
      )
      return state.portfolio
        .filter(item => item.barberId === barberId)
        .toSorted((a, b) => a.sortOrder - b.sortOrder)
        .map(({ id, imageUrl, sortOrder }) => ({ id, imageUrl, sortOrder }))
    },
  }
}

function timeOffRepo(state: AdminMemoryState): AdminRepositories['timeOff'] {
  const barberName = (barberId: string | null): string | null =>
    barberId === null ? null : (state.barbers.find(barber => barber.id === barberId)?.name ?? null)
  const withName = (item: AdminTimeOffRecord): AdminTimeOffRecord => ({ ...item, barberName: barberName(item.barberId) })
  return {
    list: async (filter: TimeOffFilter) =>
      state.adminTimeOff
        .filter(item => (filter.barberId === undefined || item.barberId === filter.barberId))
        .filter(item => (!filter.from || item.endsAt > filter.from) && (!filter.to || item.startsAt < filter.to))
        .map(withName),
    findById: async id => {
      const found = state.adminTimeOff.find(item => item.id === id)
      return found ? withName(found) : null
    },
    create: async (data: AdminTimeOffData) => {
      const created = withName({ id: randomUUID(), ...data, barberName: null })
      state.adminTimeOff = [...state.adminTimeOff, created]
      syncTimeOff(state)
      return created
    },
    update: async (id, data) => {
      if (!state.adminTimeOff.some(item => item.id === id)) return null
      const next = withName({ id, ...data, barberName: null })
      state.adminTimeOff = state.adminTimeOff.map(item => (item.id === id ? next : item))
      syncTimeOff(state)
      return next
    },
    delete: async id => {
      const before = state.adminTimeOff.length
      state.adminTimeOff = state.adminTimeOff.filter(item => item.id !== id)
      syncTimeOff(state)
      return state.adminTimeOff.length < before
    },
  }
}

function bookingRepo(state: AdminMemoryState): AdminRepositories['bookings'] {
  const find = (id: string): BookingRecord | null => {
    const found = state.bookings.find(item => item.id === id)
    return found ? publicBooking(found) : null
  }
  return {
    list: async (filter: BookingFilter) => {
      const matched = state.bookings
        .map(publicBooking)
        .filter(booking => matchesBookingFilter(state, booking, filter))
        .toSorted((a, b) => (filter.order === 'asc' ? 1 : -1) * (a.startsAt.getTime() - b.startsAt.getTime()))
      return { items: matched.slice(filter.offset, filter.offset + filter.limit), total: matched.length }
    },
    findById: async id => find(id),
    listConfirmedOverlapping: async (barberId, from, to) =>
      state.bookings
        .filter(item => item.status === 'confirmed' && (barberId === null || item.barberId === barberId))
        .filter(item => overlapsRange(item, from, to))
        .map(publicBooking),
    setStatus: async (id, from: readonly BookingStatus[], to) => {
      const current = state.bookings.find(item => item.id === id)
      if (!current || !from.includes(current.status)) return null
      state.bookings = state.bookings.map(item => (item.id === id ? { ...item, status: to } : item))
      return find(id)
    },
  }
}

function reviewRepo(state: AdminMemoryState): AdminRepositories['reviews'] {
  const matches = (review: MemoryState['reviews'][number], filter: ReviewFilter): boolean =>
    (!filter.barberId || review.barberId === filter.barberId) &&
    (filter.isPublic === undefined || review.isPublic === filter.isPublic) &&
    (filter.minRating === undefined || review.rating >= filter.minRating) &&
    (filter.maxRating === undefined || review.rating <= filter.maxRating)
  return {
    list: async (filter: ReviewFilter) => {
      const matched = state.reviews
        .filter(review => matches(review, filter))
        .toSorted((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .map(review => reviewRecord(state, review))
      return { items: matched.slice(filter.offset, filter.offset + filter.limit), total: matched.length }
    },
    setPublic: async (id, isPublic) => {
      const current = state.reviews.find(review => review.id === id)
      if (!current) return null
      state.reviews = state.reviews.map(review => (review.id === id ? { ...review, isPublic } : review))
      return reviewRecord(state, { ...current, isPublic })
    },
  }
}

/** In-memory реализация админских репозиториев над тем же состоянием, что и основные. */
export function createAdminMemoryRepositories(state: AdminMemoryState): AdminRepositories {
  return {
    auth: {
      findUserByLogin: async login => state.adminUsers.find(user => user.login === login) ?? null,
      createSession: async input => {
        state.sessions = [...state.sessions, { tokenHash: input.tokenHash, adminUserId: input.adminUserId, expiresAt: input.expiresAt }]
      },
      findActiveSession: async (tokenHash, now) => {
        const session = state.sessions.find(item => item.tokenHash === tokenHash && item.expiresAt > now)
        const user = session ? state.adminUsers.find(item => item.id === session.adminUserId) : undefined
        return session && user ? { adminUserId: session.adminUserId, login: user.login, expiresAt: session.expiresAt } : null
      },
      deleteSession: async tokenHash => {
        state.sessions = state.sessions.filter(item => item.tokenHash !== tokenHash)
      },
      deleteExpiredSessions: async (adminUserId, now) => {
        state.sessions = state.sessions.filter(item => item.adminUserId !== adminUserId || item.expiresAt > now)
      },
    },
    services: catalogRepo(state),
    barbers: barberRepo(state),
    timeOff: timeOffRepo(state),
    bookings: bookingRepo(state),
    reviews: reviewRepo(state),
    settings: {
      getAll: async () => ({ ...state.settings }),
      upsertMany: async values => {
        state.settings = { ...state.settings, ...values }
      },
    },
  }
}

/** Основные репозитории (как в приложении) + коды привязки барберов. */
export function createCoreMemoryRepositories(state: AdminMemoryState): Repositories {
  return {
    ...createMemoryRepositories(state),
    barberLinkCodes: {
      create: async input => {
        state.linkCodes = [...state.linkCodes, { code: input.code, barberId: input.barberId, expiresAt: input.expiresAt }]
      },
    },
  }
}
