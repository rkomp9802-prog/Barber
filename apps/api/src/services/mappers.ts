import type { BarberDto, BookingDto, ServiceDto } from '@barber/shared'
import { canChangeBooking } from '../domain/booking-rules'
import type { BookingRules } from '../domain/settings'
import type { BarberProfile, BookingRecord, ServiceRecord } from '../repositories/types'

export function toServiceDto(service: ServiceRecord): ServiceDto {
  return {
    id: service.id,
    name: service.name,
    description: service.description,
    durationMin: service.durationMin,
    price: service.price,
  }
}

export function toBarberDto(barber: BarberProfile): BarberDto {
  return {
    id: barber.id,
    name: barber.name,
    role: barber.role,
    bio: barber.bio,
    photoUrl: barber.photoUrl,
    experienceYears: barber.experienceYears,
    rating: barber.rating,
    reviewsCount: barber.reviewsCount,
    serviceIds: [...barber.serviceIds],
    portfolio: [...barber.portfolio],
  }
}

/** Deep link для привязки записи к Telegram (spec §11). */
export function telegramLink(botUsername: string | undefined, manageToken: string): string | null {
  return botUsername ? `https://t.me/${botUsername}?start=b_${manageToken}` : null
}

export type BookingDtoOptions = {
  readonly rules: BookingRules
  readonly now: number
  readonly botUsername: string | undefined
}

export function toBookingDto(booking: BookingRecord, options: BookingDtoOptions): BookingDto {
  return {
    id: booking.id,
    status: booking.status,
    source: booking.source,
    startsAt: booking.startsAt.toISOString(),
    endsAt: booking.endsAt.toISOString(),
    totalPrice: booking.totalPrice,
    totalDurationMin: booking.totalDurationMin,
    barber: { id: booking.barberId, name: booking.barberName },
    client: { name: booking.client.name, phone: booking.client.phone ?? '' },
    services: booking.services.map(service => ({ ...service })),
    manageToken: booking.manageToken,
    canChange: canChangeBooking(booking.status, booking.startsAt.getTime(), options.rules, options.now),
    telegramLink: telegramLink(options.botUsername, booking.manageToken),
    holdExpiresAt: booking.status === 'pending' && booking.holdExpiresAt ? booking.holdExpiresAt.toISOString() : null,
  }
}
