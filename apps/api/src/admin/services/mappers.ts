import type {
  AdminBarberDto,
  AdminBarberServiceDto,
  AdminBookingDto,
  AdminReviewDto,
  AdminServiceDto,
  AdminTimeOffDto,
  AdminBarberLinkCodeDto,
  AdminPortfolioItemDto,
  AdminMeDto,
} from '@barber/shared'
import type { BookingRecord } from '../../repositories/types'
import type {
  AdminBarberLinkRecord,
  AdminBarberRecord,
  AdminReviewRecord,
  AdminServiceRecord,
  AdminTimeOffRecord,
  PortfolioItemRecord,
} from '../repositories/types'

export function toServiceDto(service: AdminServiceRecord): AdminServiceDto {
  return {
    id: service.id,
    name: service.name,
    description: service.description,
    durationMin: service.durationMin,
    price: service.price,
    isActive: service.isActive,
    sortOrder: service.sortOrder,
  }
}

function toBarberServiceDto(link: AdminBarberLinkRecord): AdminBarberServiceDto {
  return {
    serviceId: link.serviceId,
    name: link.serviceName,
    isEnabled: link.isEnabled,
    durationMin: link.durationMin,
    price: link.price,
    effectiveDurationMin: link.durationMin ?? link.serviceDurationMin,
    effectivePrice: link.price ?? link.servicePrice,
  }
}

export function toPortfolioDto(item: PortfolioItemRecord): AdminPortfolioItemDto {
  return { id: item.id, imageUrl: item.imageUrl, sortOrder: item.sortOrder }
}

export function toBarberDto(barber: AdminBarberRecord): AdminBarberDto {
  return {
    id: barber.id,
    name: barber.name,
    role: barber.role,
    bio: barber.bio,
    photoUrl: barber.photoUrl,
    experienceYears: barber.experienceYears,
    isActive: barber.isActive,
    sortOrder: barber.sortOrder,
    telegramLinked: barber.telegramLinked,
    services: barber.services.map(toBarberServiceDto),
    portfolio: barber.portfolio.map(toPortfolioDto),
    schedule: {
      workingHours: barber.workingHours.map(range => ({ ...range })),
      breaks: barber.breaks.map(range => ({ ...range })),
    },
  }
}

export function toBookingDto(booking: BookingRecord): AdminBookingDto {
  return {
    id: booking.id,
    status: booking.status,
    source: booking.source,
    startsAt: booking.startsAt.toISOString(),
    endsAt: booking.endsAt.toISOString(),
    totalPrice: booking.totalPrice,
    totalDurationMin: booking.totalDurationMin,
    barber: { id: booking.barberId, name: booking.barberName },
    client: { id: booking.clientId, name: booking.client.name, phone: booking.client.phone ?? '' },
    services: booking.services.map(service => ({ ...service })),
    createdAt: booking.createdAt.toISOString(),
  }
}

export function toTimeOffDto(record: AdminTimeOffRecord): AdminTimeOffDto {
  return {
    id: record.id,
    barberId: record.barberId,
    barberName: record.barberName,
    startsAt: record.startsAt.toISOString(),
    endsAt: record.endsAt.toISOString(),
    type: record.type,
    note: record.note,
  }
}

export function toReviewDto(review: AdminReviewRecord): AdminReviewDto {
  return {
    id: review.id,
    bookingId: review.bookingId,
    bookingStartsAt: review.bookingStartsAt.toISOString(),
    barber: { id: review.barberId, name: review.barberName },
    client: { name: review.clientName, phone: review.clientPhone ?? '' },
    rating: review.rating,
    comment: review.comment ?? '',
    isPublic: review.isPublic,
    createdAt: review.createdAt.toISOString(),
  }
}

export function toMeDto(session: { adminUserId: string; login: string; expiresAt: Date }): AdminMeDto {
  return { id: session.adminUserId, login: session.login, sessionExpiresAt: session.expiresAt.toISOString() }
}

export function toLinkCodeDto(code: string, link: string | null, expiresAt: Date): AdminBarberLinkCodeDto {
  return { code, link: link ?? '', expiresAt: expiresAt.toISOString() }
}
